import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentsForInvoice,
  buildOutstandingRows,
  summariseByCustomer,
  isOverdue,
  countOverdue,
  isInvoicePaid,
} from '../src/utils/serviceOutstanding.js';

/* The Outstanding page and the Reports tab must never disagree about what a
   customer still owes, so the rules live here and are exercised directly. */

const invoice = (over = {}) => ({
  id: 1, customer: 'Acme', amount: 'GHS 500', status: 'unpaid', date: '2026-01-10',
  items: [{ name: 'Brand work', qty: 1, rate: 500 }], ...over,
});

const payment = (over = {}) => ({
  platformTag: 'payment', amount: 200, platformFee: 0, notes: 'payment for invoice #1', ...over,
});

test('a payment is tied to an invoice by its notes text', () => {
  const income = [payment(), payment({ notes: 'payment for invoice #12' })];
  assert.equal(paymentsForInvoice(income, invoice()).length, 1);
});

test('invoice #1 does not match a payment for invoice #12', () => {
  const income = [payment({ notes: 'payment for invoice #12' })];
  assert.equal(paymentsForInvoice(income, invoice()).length, 0);
});

test('an unpaid invoice with no payment is fully outstanding', () => {
  const [row] = buildOutstandingRows([invoice()], []);
  assert.equal(row.balance, 500);
  assert.equal(row.paid, 0);
});

test('part-paid invoice shows the remainder, not the full amount', () => {
  const [row] = buildOutstandingRows([invoice()], [payment()]);
  assert.equal(row.paid, 200);
  assert.equal(row.balance, 300);
});

test('an invoice marked paid is never outstanding', () => {
  const rows = buildOutstandingRows([invoice({ status: 'paid' })], []);
  assert.equal(rows.length, 0);
});

test('a legacy title-case Paid status is honoured too', () => {
  // The column default is 'Pending'; older rows are title-case.
  assert.equal(buildOutstandingRows([invoice({ status: 'Paid' })], []).length, 0);
  assert.equal(isInvoicePaid({ status: 'PAID' }), true);
  assert.equal(isInvoicePaid({ status: 'Pending' }), false);
  assert.equal(isInvoicePaid({ status: 'pending' }), false);
  assert.equal(isInvoicePaid({ status: '' }), false);
});

test('an invoice billed at no amount is not reported as debt', () => {
  assert.equal(buildOutstandingRows([invoice({ amount: '' })], []).length, 0);
});

test('settled invoices are excluded entirely', () => {
  const income = [
    payment({ amount: 250, platformFee: 0 }),
    payment({ amount: 250, platformFee: 0 }),
  ];
  assert.equal(buildOutstandingRows([invoice()], income).length, 0);
});

test('an overpayment is clamped, so a double entry cannot show a negative balance', () => {
  const income = [payment({ amount: 900, platformFee: 0 })];
  // paid would be 900 against a 500 invoice, but the row is dropped rather
  // than reported as owing the customer -500.
  assert.deepEqual(buildOutstandingRows([invoice()], income), []);
});

test('an overpayment on one invoice does not spill onto another', () => {
  const income = [
    payment({ amount: 900, platformFee: 0, notes: 'payment for invoice #1' }),
  ];
  const rows = buildOutstandingRows([
    invoice({ id: 1, amount: 'GHS 500' }),
    invoice({ id: 2, customer: 'Beta', amount: 'GHS 300', date: '2026-01-12' }),
  ], income);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customer, 'Beta');
  assert.equal(rows[0].balance, 300);
});

test('platform fees reduce what counts as paid', () => {
  // netAmount is what actually landed in the account, so it is what counts —
  // the same basis the dashboard and P&L use.
  const income = [payment({ amount: 200, platformFee: 20, netAmount: 180 })];
  const [row] = buildOutstandingRows([invoice()], income);
  assert.equal(row.paid, 180);
  assert.equal(row.balance, 320);
});

test('a payment with no net amount falls back to the gross amount', () => {
  const [row] = buildOutstandingRows([invoice()], [payment()]);
  assert.equal(row.paid, 200);
});

test('rows with no balance are dropped', () => {
  const income = [payment({ amount: 500, platformFee: 0 })];
  assert.equal(buildOutstandingRows([invoice()], income).length, 0);
});

test('the service name falls back to the invoice number when there are no line items', () => {
  const [row] = buildOutstandingRows([invoice({ items: [] })], []);
  assert.equal(row.service, 'Invoice #1');
});

test('a missing customer is labelled rather than left blank', () => {
  const [row] = buildOutstandingRows([invoice({ customer: null })], []);
  assert.equal(row.customer, 'Unknown');
});

test('most recently dated invoice is listed first', () => {
  const rows = buildOutstandingRows([
    invoice({ id: 1, date: '2026-01-10' }),
    invoice({ id: 2, date: '2026-03-10' }),
  ], []);
  assert.equal(rows[0].invoiceId, 2);
});

test('customer summary rolls items up, largest balance first', () => {
  const rows = buildOutstandingRows([
    invoice({ id: 1, customer: 'Small', amount: 'GHS 50', date: '2026-02-01' }),
    invoice({ id: 2, customer: 'Big', amount: 'GHS 900', date: '2026-01-05' }),
    invoice({ id: 3, customer: 'Big', amount: 'GHS 100', date: '2026-03-01' }),
  ], []);
  const summary = summariseByCustomer(rows);
  assert.equal(summary[0].name, 'Big');
  assert.equal(summary[0].count, 2);
  assert.equal(summary[0].total, 1000);
  assert.equal(summary[0].oldest, '2026-01-05');
});

test('an item past its date is overdue, one dated today or later is not', () => {
  const rows = [
    { date: '2026-01-10' }, { date: '2026-10-05' }, { date: '2026-11-01' },
  ];
  assert.deepEqual(rows.map(r => isOverdue(r, '2026-10-05')), [true, false, false]);
});

test('an undated item is not counted as overdue', () => {
  assert.equal(isOverdue({ date: '' }, '2026-10-05'), false);
  assert.equal(countOverdue([{ date: '' }, { date: '2026-01-01' }], '2026-10-05'), 1);
});

test('an empty invoice list produces no outstanding rows', () => {
  assert.deepEqual(buildOutstandingRows([], []), []);
  assert.deepEqual(summariseByCustomer([]), []);
});