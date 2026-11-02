import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RENEWAL_WINDOW_DAYS,
  localTodayIso,
  daysUntil,
  renewalHint,
  renewalTone,
  addMonths,
  renewalCycleMonths,
  nextRenewalDate,
  summariseRenewals,
} from '../src/utils/renewals.js';

/* A renewal date is the one expense field the dashboard has to interpret, and
   the old comparison (`new Date(date) >= new Date()`) dropped every renewal the
   moment it came due. These pin down the two things that went wrong: a renewal
   due today counts, and an overdue one is still reported. */

const TODAY = '2026-11-01';

test('a renewal due today is zero days away, not already in the past', () => {
  assert.equal(daysUntil('2026-11-01', TODAY), 0);
  assert.equal(renewalHint(0), 'due today');
});

test('a passed renewal is negative, so it can be reported rather than skipped', () => {
  assert.equal(daysUntil('2026-10-29', TODAY), -3);
  assert.equal(renewalHint(-3), 'overdue by 3 days');
  assert.equal(renewalHint(-1), 'overdue by 1 day');
});

test('a missing or unparseable date yields null, never NaN or a count', () => {
  assert.equal(daysUntil('', TODAY), null);
  assert.equal(daysUntil(null, TODAY), null);
  assert.equal(daysUntil('not-a-date', TODAY), null);
  assert.equal(renewalHint(null), '');
  assert.equal(renewalTone(null), undefined);
});

test('today is not counted in tomorrow terms', () => {
  assert.equal(renewalHint(1), 'due tomorrow');
  assert.equal(renewalHint(14), 'in 14 days');
});

test('the window includes its last day', () => {
  assert.equal(daysUntil('2026-12-01', TODAY), RENEWAL_WINDOW_DAYS);
  const summary = summariseRenewals(
    [{ renewalDate: '2026-12-01' }, { renewalDate: '2026-12-02' }],
    TODAY,
  );
  assert.equal(summary.dueSoon, 1);
});

test('overdue renewals are counted, not dropped', () => {
  const summary = summariseRenewals(
    [
      { renewalDate: '2026-09-04' },
      { renewalDate: '2026-10-29' },
      { renewalDate: '2026-11-01' },
      { renewalDate: '2026-11-15' },
      { renewalDate: null },
    ],
    TODAY,
  );
  assert.equal(summary.overdue, 2);
  assert.equal(summary.dueSoon, 2);
  assert.equal(summary.needsAttention, 4);
  assert.equal(summary.total, 4);
});

test('an expense with no renewal date counts as nothing at all', () => {
  assert.deepEqual(summariseRenewals([{ renewalDate: null }, {}], TODAY), {
    overdue: 0,
    dueSoon: 0,
    needsAttention: 0,
    total: 0,
  });
});

test('today is a local calendar date, so it cannot drift a day east of UTC', () => {
  assert.equal(localTodayIso(new Date(2026, 10, 1, 0, 30)), '2026-11-01');
  assert.equal(localTodayIso(new Date(2026, 0, 9, 23, 30)), '2026-01-09');
});

test('adding months clamps to the end of a shorter month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-15', 3), '2026-04-15');
  assert.equal(addMonths('2026-11-01', 12), '2027-11-01');
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
});

test('the cycle is read from the gap between the charge and the renewal', () => {
  assert.equal(renewalCycleMonths({ date: '2026-09-29', renewalDate: '2026-10-29' }), 1);
  assert.equal(renewalCycleMonths({ date: '2026-05-10', renewalDate: '2026-08-10' }), 3);
  assert.equal(renewalCycleMonths({ date: '2025-01-05', renewalDate: '2026-01-05' }), 12);
});

test('an unreadable gap falls back to the commonest cycle, one month', () => {
  assert.equal(renewalCycleMonths({ date: null, renewalDate: '2026-10-15' }), 1);
  assert.equal(renewalCycleMonths({ date: '2026-10-15', renewalDate: '2026-10-20' }), 1);
  assert.equal(renewalCycleMonths({}), 1);
});

test('marking an overdue monthly bill renewed lands on the next future cycle', () => {
  const expense = { date: '2026-09-29', renewalDate: '2026-10-29' };
  assert.equal(nextRenewalDate(expense, TODAY), '2026-11-29');
});

test('a renewal months behind jumps to the upcoming date, not the next missed one', () => {
  const expense = { date: '2026-08-05', renewalDate: '2026-09-04' };
  assert.equal(nextRenewalDate(expense, TODAY), '2026-11-04');
});

test('a yearly bill advances a year, not a month', () => {
  const expense = { date: '2025-01-05', renewalDate: '2026-01-05' };
  assert.equal(nextRenewalDate(expense, TODAY), '2027-01-05');
});

test('a quarterly bill advances a quarter', () => {
  const expense = { date: '2026-05-10', renewalDate: '2026-08-10' };
  assert.equal(nextRenewalDate(expense, TODAY), '2026-11-10');
});

test('a renewal due today moves on to the next cycle when marked renewed', () => {
  const expense = { date: '2026-10-01', renewalDate: '2026-11-01' };
  assert.equal(nextRenewalDate(expense, TODAY), '2026-12-01');
});

test('an undated renewal has no next date to offer', () => {
  assert.equal(nextRenewalDate({ date: '2026-10-01', renewalDate: null }, TODAY), null);
});
