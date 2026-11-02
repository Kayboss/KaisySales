/**
 * Expense renewal rules.
 *
 * A renewal date is the one date on an expense that a dashboard cannot read:
 * "2026-10-29" says nothing about whether money is about to leave, and a date
 * that has already passed says nothing at all once it is skipped. So the whole
 * question — is this renewal live, overdue, or due next week — is answered here,
 * once, from calendar days rather than from clock time.
 *
 * Deliberately pure and import-free so it runs in plain Node and can be pinned
 * down by a test: a renewal that is due today must count, and an overdue one
 * must never silently disappear from the list.
 */

/** How far ahead the "upcoming" window reaches. */
export const RENEWAL_WINDOW_DAYS = 30;

const pad = (n) => String(n).padStart(2, '0');

/** Today as a LOCAL calendar date. Built from local parts, never
 *  `toISOString()`, which returns yesterday east of UTC. */
export const localTodayIso = (today = new Date()) =>
  `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

/**
 * Whole calendar days from `todayIso` to `iso` (negative when already past).
 *
 * Both sides are anchored at UTC midnight, so only the calendar date is
 * compared: a renewal due today is 0, not "midnight has passed", and no local
 * offset or DST shift can move a renewal into the wrong day.
 *
 * Returns null when either value is missing or unparseable.
 */
export const daysUntil = (iso, todayIso) => {
  if (!iso || !todayIso) return null;
  const target = Date.parse(`${iso}T00:00:00Z`);
  const base = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(base)) return null;
  return Math.round((target - base) / 86400000);
};

/** A countdown a person can act on. '' when there is no usable date. */
export const renewalHint = (days) => {
  if (days === null || days === undefined) return '';
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `in ${days} days`;
};

/** overdue | soon | undefined, for the row's colour. */
export const renewalTone = (days) => {
  if (days === null || days === undefined) return undefined;
  if (days < 0) return 'overdue';
  if (days <= 7) return 'soon';
  return undefined;
};

/**
 * Add whole months to a stored date, keeping the day of the month and clamping
 * it: a renewal on the 31st becomes the last day of a shorter month rather than
 * spilling into the next one.
 */
export const addMonths = (iso, months) => {
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return iso;
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted.toISOString().slice(0, 10);
};

/* Expenses carry no billing-cycle column, so the cycle is read off the record
   itself: the gap between the charge date and the renewal date says whether this
   is a monthly, quarterly or yearly bill. */
const RENEWAL_CYCLES = [
  { months: 1, days: 30, tolerance: 5 },
  { months: 3, days: 91, tolerance: 10 },
  { months: 12, days: 365, tolerance: 20 },
];

/** 1, 3 or 12 — the commonest case (monthly) when the gap says nothing. */
export const renewalCycleMonths = (expense = {}) => {
  const span = daysUntil(expense.renewalDate, expense.date);
  if (span === null || span <= 0) return 1;
  const match = RENEWAL_CYCLES.find((c) => Math.abs(span - c.days) <= c.tolerance);
  return match ? match.months : 1;
};

/**
 * The next renewal that has not happened yet.
 *
 * A bill three cycles behind lands on the upcoming date, not on the one just
 * after the first missed one — marking a lapsed subscription renewed should not
 * leave it reading "overdue" again.
 */
export const nextRenewalDate = (expense = {}, todayIso) => {
  if (!expense.renewalDate) return null;
  const months = renewalCycleMonths(expense);
  let next = expense.renewalDate;
  for (let i = 0; i < 120 && next <= todayIso; i += 1) {
    next = addMonths(next, months);
  }
  return next;
};

/**
 * Splits every dated expense into what the cards need: how many are overdue,
 * how many fall in the next `RENEWAL_WINDOW_DAYS`, and how many need attention
 * (both). Overdue rows are counted — dropping them is how a monthly
 * subscription went silent, its date stuck in the past while the card read 0.
 */
export const summariseRenewals = (expenses = [], todayIso) => {
  const days = expenses
    .map((e) => daysUntil(e.renewalDate, todayIso))
    .filter((d) => d !== null);
  const overdue = days.filter((d) => d < 0).length;
  const dueSoon = days.filter((d) => d >= 0 && d <= RENEWAL_WINDOW_DAYS).length;
  return { overdue, dueSoon, needsAttention: overdue + dueSoon, total: days.length };
};
