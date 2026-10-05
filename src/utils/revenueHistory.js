import { parseAmount } from './currency.js';

/**
 * Month bucketing for the services Revenue History page.
 *
 * `recurring_income` is deliberately NOT an input here. It stores `amount` and
 * `next_due_date` as a forward-looking schedule of expectation and keeps no
 * record of what was actually received, so folding it into a history would
 * report money that was never collected. Revenue history is built only from
 * `service_income`, whose `payment_date` records when money was received.
 *
 * Month keys are LOCAL calendar months ("YYYY-MM") built from local date parts,
 * never from `toISOString()`. toISOString() converts to UTC first, which in
 * Accra (UTC+0, so fine) but in any positive-offset zone pushes an evening
 * payment into the next month — the classic "revenue lands in the wrong month"
 * bug. Grouping by the same local parts used to render the label keeps a row in
 * the month the user actually saw when they entered it.
 */

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local "YYYY-MM" for a Date. */
export const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Parse a stored date value, returning null rather than an Invalid Date. */
export const parseLocalDate = (value) => {
  if (!value) return null;
  // A bare "YYYY-MM-DD" is read as local midnight. `new Date('2026-03-01')` is
  // parsed as UTC midnight, which in a negative-offset zone is the previous
  // local day and would file the row in the wrong month.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "YYYY-MM" for a stored date value, or null when unparseable/absent. */
export const monthKeyFor = (value) => {
  const date = parseLocalDate(value);
  return date ? monthKeyOf(date) : null;
};

/** Human label, e.g. "Mar 2026". */
export const monthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
};

/** Shift a "YYYY-MM" key by whole months, so there is no day-of-month rollover. */
export const shiftMonthKey = (key, delta) => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKeyOf(date);
};

/** First and last day of a "YYYY-MM" key, as local ISO dates. */
export const monthBounds = (key) => {
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${key}-01`, end: `${key}-${String(lastDay).padStart(2, '0')}` };
};

/**
 * Group income rows into calendar months, newest first.
 *
 * Only months that actually contain a row are returned — no empty padding — so
 * a gap in the data reads as "nothing came in that month" rather than a zero
 * the owner might mistake for a real figure. Callers that want a continuous
 * timeline (a chart) build it with `continuousMonthKeys`.
 *
 * Each month reports received/gross/fees/expenses/profit on the one basis the
 * rest of the services screens use, via serviceFinance, so this page cannot
 * drift from the dashboard or the P&L report.
 */
export const groupByMonth = (income = [], expenses = [], receivedOf) => {
  const expenseByMonth = {};
  expenses.forEach(row => {
    const key = monthKeyFor(row.date);
    if (!key) return;
    expenseByMonth[key] = (expenseByMonth[key] || 0) + parseAmount(row.amount);
  });

  const buckets = new Map();
  const bucketFor = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, { key, label: monthLabel(key), income: [], expenses: [], received: 0, gross: 0, fees: 0 });
    }
    return buckets.get(key);
  };

  income.forEach(row => {
    const key = monthKeyFor(row.paymentDate);
    if (!key) return;
    const bucket = bucketFor(key);
    bucket.income.push(row);
    bucket.received += receivedOf(row);
    bucket.gross += parseAmount(row.amount);
    bucket.fees += parseAmount(row.platformFee);
  });

  Object.entries(expenseByMonth).forEach(([key, total]) => {
    const bucket = bucketFor(key);
    bucket.expenses.push({ date: `${key}-01`, amount: String(total) });
    bucket.spent = total;
  });

  return [...buckets.values()]
    .map(bucket => ({
      ...bucket,
      spent: bucket.spent || 0,
      // Platform fees are money that left before the owner saw it, so profit is
      // measured on income RECEIVED, never on gross — same basis as the P&L.
      profit: bucket.received - (bucket.spent || 0),
      margin: bucket.received > 0 ? (((bucket.received - (bucket.spent || 0)) / bucket.received) * 100).toFixed(1) : null,
      count: bucket.income.length,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
};

/**
 * A gapless run of month keys, oldest first, for charting. Inclusive of both
 * `from` and `to`, so a caller can build the exact span a range filter covers.
 */
export const continuousMonthKeys = (from, to) => {
  const keys = [];
  let cursor = from;
  // Bounded so a reversed or nonsensical range cannot spin here.
  for (let guard = 0; guard < 600 && cursor <= to; guard += 1) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
};