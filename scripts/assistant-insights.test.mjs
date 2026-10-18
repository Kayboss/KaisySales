import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsights, topSeverity } from '../src/utils/assistant/insights.js';

const scope = (over = {}) => ({
  incomeTotal: 0,
  incomeCount: 0,
  expenseTotal: 0,
  expenseCount: 0,
  profit: 0,
  inventoryCount: 0,
  lowStock: [],
  unpricedCount: 0,
  outstandingTotal: 0,
  overdueCount: 0,
  overdueTotal: 0,
  overdueCustomers: [],
  recurringCount: 0,
  nextRecurring: null,
  ...over,
});

const context = (mode, month = {}, allTime = {}, extra = {}) => ({
  mode,
  currency: 'GHS',
  todayIso: '2026-10-18',
  statsByScope: {
    'this month': scope(month),
    'all time': scope({ incomeCount: 1, expenseCount: 1, ...allTime }),
  },
  ...extra,
});

const ids = (insights) => insights.map((i) => i.id);

// Intl puts a non-breaking space after the ISO code, so match on a normalised copy.
const flat = (text) => String(text).replace(/[\u00a0\u202f]/g, ' ');

test('a business with no records is told exactly where the first one goes', () => {
  const retail = buildInsights(context('retail', {}, { incomeCount: 0, expenseCount: 0 }));
  assert.deepEqual(ids(retail), ['start']);
  assert.equal(retail[0].route, '/sales');
  assert.equal(retail[0].action, 'Record a sale');

  const services = buildInsights(context('services', {}, { incomeCount: 0, expenseCount: 0 }));
  assert.equal(services[0].route, '/income');
  assert.equal(services[0].action, 'Add income');
});

test('retail flags stock before anything low priority', () => {
  const insights = buildInsights(
    context('retail', {
      incomeCount: 2,
      profit: 500,
      lowStock: [
        { name: 'Cement', stock: 0, minStock: 5 },
        { name: 'Sugar', stock: 2, minStock: 5 },
      ],
      unpricedCount: 2,
    })
  );
  assert.deepEqual(ids(insights), ['stock-out', 'low-stock', 'unpriced']);
  assert.match(insights[0].body, /Cement/);
  assert.doesNotMatch(insights[0].body, /Sugar/);
  assert.equal(insights[0].route, '/inventory');
});

test('retail never shows invoice or recurring insights', () => {
  const insights = buildInsights(
    context('retail', { incomeCount: 1, overdueCount: 3, outstandingTotal: 900, recurringCount: 2 })
  );
  assert.deepEqual(ids(insights).filter((id) => /overdue|outstanding|recurring/.test(id)), []);
});

test('services flags overdue invoices first, naming who owes', () => {
  const insights = buildInsights(
    context('services', {
      incomeCount: 3,
      profit: 100,
      overdueCount: 2,
      overdueTotal: 4000,
      overdueCustomers: ['Kwame', 'Ama'],
    })
  );
  assert.equal(insights[0].id, 'overdue');
  assert.equal(insights[0].severity, 'high');
  assert.match(insights[0].body, /2 invoices/);
  assert.match(flat(insights[0].body), /GHS 4,000\.00/);
  assert.match(insights[0].body, /Kwame, Ama/);
  assert.equal(insights[0].route, '/service-outstanding');
});

test('settled-but-unpaid replaces the overdue note rather than adding to it', () => {
  const insights = buildInsights(context('services', { incomeCount: 1, outstandingTotal: 900 }));
  assert.deepEqual(ids(insights), ['outstanding']);
  assert.equal(insights[0].severity, 'low');

  const overdue = buildInsights(
    context('services', { incomeCount: 1, outstandingTotal: 900, overdueCount: 1, overdueTotal: 900 })
  );
  assert.deepEqual(ids(overdue).filter((id) => id === 'outstanding'), []);
});

test('services never shows stock insights', () => {
  const insights = buildInsights(
    context('services', { incomeCount: 1, lowStock: [{ name: 'X', stock: 0, minStock: 5 }], unpricedCount: 3 })
  );
  assert.deepEqual(ids(insights).filter((id) => /stock|unpriced/.test(id)), []);
});

test('a recurring payment is flagged only inside the next week', () => {
  const soon = buildInsights(
    context('services', {
      incomeCount: 1,
      nextRecurring: { clientName: 'Kwame', amount: 500, nextDueDate: '2026-10-21' },
    })
  );
  assert.deepEqual(ids(soon), ['recurring-due']);
  assert.match(soon[0].body, /Kwame is due in 3 days/);

  const later = buildInsights(
    context('services', {
      incomeCount: 1,
      nextRecurring: { clientName: 'Kwame', amount: 500, nextDueDate: '2026-11-21' },
    })
  );
  assert.deepEqual(ids(later), []);
});

test('a past recurring date reads as overdue, not negative days', () => {
  const insights = buildInsights(
    context('services', {
      incomeCount: 1,
      nextRecurring: { clientName: 'Ama', amount: 200, nextDueDate: '2026-10-10' },
    })
  );
  assert.match(insights[0].body, /Ama is overdue/);
});

test('a month running at a loss is flagged in both modes, pointing at the reports', () => {
  const retail = buildInsights(context('retail', { incomeCount: 2, incomeTotal: 100, expenseTotal: 400, profit: -300 }));
  assert.equal(retail[0].id, 'in-the-red');
  assert.equal(retail[0].route, '/reporting');
  assert.match(flat(retail[0].body), /GHS 300\.00 in the red/);

  const services = buildInsights(
    context('services', { incomeCount: 2, incomeTotal: 100, expenseTotal: 400, profit: -300 })
  );
  assert.equal(services[0].route, '/service-reporting');
});

test('a quiet month is noted only when there is history behind it', () => {
  const quiet = buildInsights(context('retail', {}, { incomeCount: 4 }));
  assert.ok(ids(quiet).includes('quiet-month'));

  const fresh = buildInsights(context('retail', {}, { incomeCount: 0, expenseCount: 0 }));
  assert.deepEqual(ids(fresh), ['start']);
});

test('a healthy month produces nothing to shout about', () => {
  const insights = buildInsights(context('retail', { incomeCount: 5, incomeTotal: 5000, profit: 3000 }));
  assert.deepEqual(insights, []);
  assert.equal(topSeverity(insights), null);
});

test('topSeverity names the worst level present', () => {
  const insights = buildInsights(
    context('retail', {
      incomeCount: 1,
      profit: 50,
      lowStock: [{ name: 'Cement', stock: 1, minStock: 5 }],
      unpricedCount: 1,
    })
  );
  assert.equal(topSeverity(insights), 'medium');
});

test('amounts are rendered as the ISO code', () => {
  const insights = buildInsights(context('services', { incomeCount: 1, outstandingTotal: 1500 }));
  assert.match(flat(insights[0].body), /GHS 1,500\.00/);
});
