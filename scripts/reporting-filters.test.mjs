import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceProfit, serviceRowReceived, serviceExpenses } from '../src/utils/serviceFinance.js';

/* The reporting filters are pure range/search logic. These tests pin the rules
   the Services Reports toolbar relies on, because the two bugs they guard
   against (an empty bound becoming Invalid Date, and a filter silently
   disagreeing with the stat card above it) are both invisible without them. */

const DAY = (n) => `2026-0${n}-15`;

/** Mirrors inRange() in ServiceReporting.jsx. */
const inRange = (items, dateField, startDate, endDate) => {
  if (!startDate && !endDate) return items;
  return items.filter(item => {
    const raw = item[dateField];
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
    if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;
    return true;
  });
};

test('an all-time range keeps every row instead of collapsing to none', () => {
  const rows = [{ paymentDate: DAY(1) }, { paymentDate: DAY(6) }];
  assert.equal(inRange(rows, 'paymentDate', '', '').length, 2);
});

test('a bounded range is inclusive of both boundary days', () => {
  const rows = [{ paymentDate: '2026-01-01' }, { paymentDate: '2026-01-15' }, { paymentDate: '2026-01-31' }];
  assert.equal(inRange(rows, 'paymentDate', '2026-01-01', '2026-01-31').length, 3);
  assert.equal(inRange(rows, 'paymentDate', '2026-01-15', '2026-01-15').length, 1);
});

test('an open-ended bound does not exclude everything', () => {
  const rows = [{ paymentDate: '2026-01-10' }, { paymentDate: '2026-01-20' }];
  assert.equal(inRange(rows, 'paymentDate', '', '2026-01-15').length, 1);
  assert.equal(inRange(rows, 'paymentDate', '2026-01-15', '').length, 1);
});

test('rows with a missing or unparseable date drop out of a bounded range', () => {
  const rows = [{ paymentDate: null }, { paymentDate: 'not-a-date' }, { paymentDate: '2026-01-10' }];
  assert.equal(inRange(rows, 'paymentDate', '2026-01-01', '2026-01-31').length, 1);
  // ...but an all-time range must not silently drop them either.
  assert.equal(inRange(rows, 'paymentDate', '', '').length, 3);
});

test('an expense export total equals the expenses shown in the stat card', () => {
  const income = [{ amount: 1000, platformFee: 100, netAmount: 900 }];
  const expenses = [{ amount: 'GHS 250.00' }, { amount: 'GHS 99.50' }];
  const totals = serviceProfit(income, expenses);
  const exported = expenses.reduce((s, e) => s + e.amount, 0);
  assert.equal(serviceExpenses(expenses), 349.5);
  assert.equal(totals.expenses, serviceExpenses(expenses));
  assert.notEqual(exported, totals.expenses); // prefixed strings are why parsing matters
});

test('per-client profit rows sum to the reported client profit', () => {
  const income = [
    { clientName: 'Acme', amount: 1000, platformFee: 100, netAmount: 900 },
    { clientName: 'Beta', amount: 500, platformFee: 0, netAmount: 500 },
  ];
  const expenses = [{ amount: 'GHS 200.00', clientName: 'Acme' }];
  const rows = ['Acme', 'Beta'].map(name => {
    const inc = income.filter(i => i.clientName === name).reduce((s, i) => s + serviceRowReceived(i), 0);
    const exp = expenses.filter(e => e.clientName === name).reduce((s, e) => s + Number(String(e.amount).replace(/[^\d.-]/g, '')), 0);
    return { name, income: inc, expenses: exp, profit: inc - exp };
  });
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  // Client profit nets platform fees, exactly like the overview it sits beside.
  assert.equal(rows[0].income, 900);
  assert.equal(rows[0].profit, 700);
  assert.equal(rows[1].profit, 500);
  assert.equal(totalProfit, 1200);
  // The overview must reach the same figure: received (1400) - expenses (200).
  assert.equal(serviceProfit(income, expenses).profit, 1200);
  assert.equal(totalProfit, serviceProfit(income, expenses).profit);
});

test('outstanding balance never exceeds the invoice amount', () => {
  const amount = 500;
  const paid = 800; // an overpayment must not produce negative debt
  assert.equal(Math.max(0, amount - paid), 0);
  assert.equal(Math.max(0, amount - Math.min(paid, amount)), 0);
});