import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthKeyFor,
  monthLabel,
  shiftMonthKey,
  monthBounds,
  groupByMonth,
  continuousMonthKeys,
} from '../src/utils/revenueHistory.js';

const receivedOf = (row) => {
  const net = row.netAmount;
  return net === null || net === undefined || net === '' || Number(net) === 0 ? Number(row.amount) : Number(net);
};

test('monthKeyFor files a bare YYYY-MM-DD in the month the user entered', () => {
  assert.equal(monthKeyFor('2026-03-01'), '2026-03');
  assert.equal(monthKeyFor('2026-12-31'), '2026-12');
});

test('monthKeyFor returns null for missing or unparseable dates rather than NaN', () => {
  assert.equal(monthKeyFor(null), null);
  assert.equal(monthKeyFor(''), null);
  assert.equal(monthKeyFor('not-a-date'), null);
});

test('monthLabel renders a human month and year', () => {
  assert.equal(monthLabel('2026-03'), 'Mar 2026');
  assert.equal(monthLabel('2026-01'), 'Jan 2026');
  assert.equal(monthLabel('2026-12'), 'Dec 2026');
});

test('shiftMonthKey crosses year boundaries in both directions', () => {
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
  assert.equal(shiftMonthKey('2026-03', -3), '2025-12');
  assert.equal(shiftMonthKey('2026-03', 3), '2026-06');
});

test('monthBounds handles 31-day, 30-day and leap February', () => {
  assert.deepEqual(monthBounds('2026-01'), { start: '2026-01-01', end: '2026-01-31' });
  assert.deepEqual(monthBounds('2026-04'), { start: '2026-04-01', end: '2026-04-30' });
  assert.deepEqual(monthBounds('2024-02'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
});

test('groupByMonth buckets income newest first and omits months with no rows', () => {
  const rows = groupByMonth(
    [
      { paymentDate: '2026-03-10', amount: 100, netAmount: 90, platformFee: 10 },
      { paymentDate: '2026-05-02', amount: 200, netAmount: 200, platformFee: 0 },
      { paymentDate: '2026-01-15', amount: 50, netAmount: 50, platformFee: 0 },
    ],
    [],
    receivedOf,
  );

  assert.deepEqual(rows.map(r => r.key), ['2026-05', '2026-03', '2026-01']);
  assert.equal(rows[0].received, 200);
  assert.equal(rows[1].received, 90);
  // April had no rows, so it must not appear as a misleading zero month.
  assert.ok(!rows.some(r => r.key === '2026-04'));
});

test('groupByMonth measures profit on income received, never on gross', () => {
  const [month] = groupByMonth(
    [{ paymentDate: '2026-03-10', amount: 100, netAmount: 90, platformFee: 10 }],
    [{ date: '2026-03-12', amount: 'GHS 30.00' }],
    receivedOf,
  );

  assert.equal(month.gross, 100);
  assert.equal(month.fees, 10);
  assert.equal(month.received, 90);
  assert.equal(month.spent, 30);
  assert.equal(month.profit, 60);
  assert.equal(month.margin, '66.7');
});

test('groupByMonth treats a 0 net_amount as never computed and falls back to gross', () => {
  // Mirrors serviceRowReceived: net_amount is nullable with DEFAULT 0, so a
  // stored 0 means "not computed", not "nothing received".
  const [month] = groupByMonth(
    [{ paymentDate: '2026-03-10', amount: 75, netAmount: 0, platformFee: 0 }],
    [],
    receivedOf,
  );
  assert.equal(month.received, 75);
});

test('groupByMonth ignores rows with no usable date instead of dropping them in one bucket', () => {
  const rows = groupByMonth(
    [
      { paymentDate: '2026-03-10', amount: 100, netAmount: 100 },
      { paymentDate: null, amount: 999, netAmount: 999 },
    ],
    [],
    receivedOf,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].received, 100);
});

test('groupByMonth keeps an expense-only month so spending never goes invisible', () => {
  const rows = groupByMonth(
    [{ paymentDate: '2026-03-10', amount: 100, netAmount: 100 }],
    [
      { date: '2026-04-05', amount: 'GHS 40.00' },
      { date: '2026-03-05', amount: 'GHS 10.00' },
    ],
    receivedOf,
  );
  assert.deepEqual(rows.map(r => r.key), ['2026-04', '2026-03']);
  assert.equal(rows[0].received, 0);
  assert.equal(rows[0].spent, 40);
  // No income means no margin, rather than a misleading 0%.
  assert.equal(rows[0].margin, null);
  assert.equal(rows[0].profit, -40);
});

test('groupByMonth survives an empty or missing set', () => {
  assert.deepEqual(groupByMonth([], [], receivedOf), []);
  assert.deepEqual(groupByMonth(undefined, undefined, receivedOf), []);
});

test('groupByMonth counts the payments inside each month', () => {
  const rows = groupByMonth(
    [
      { paymentDate: '2026-03-01', amount: 10, netAmount: 10 },
      { paymentDate: '2026-03-20', amount: 20, netAmount: 20 },
    ],
    [],
    receivedOf,
  );
  assert.equal(rows[0].count, 2);
});

test('continuousMonthKeys spans inclusively and crosses a year boundary', () => {
  assert.deepEqual(continuousMonthKeys('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(continuousMonthKeys('2026-05', '2026-05'), ['2026-05']);
});

test('continuousMonthKeys returns nothing for a reversed range instead of spinning', () => {
  assert.deepEqual(continuousMonthKeys('2026-05', '2026-01'), []);
});