import { formatCurrency } from '../currency.js';

/**
 * Assistant insights builder.
 *
 * The panel is a "what needs your attention" surface, not a second way to type
 * a record: every entry here is a fact the owner would otherwise have to notice
 * themselves. Each one is derived from the SAME `statsByScope` the Q&A engine is
 * given (which in turn is built from the same pure helpers the dashboards use),
 * so an insight can never disagree with the screen it links to.
 *
 * Deliberately pure and import-light (only the shared currency helper) so it
 * runs in plain Node. It never reads the clock itself when a caller supplies
 * `todayIso`, so a "due soon" claim is testable rather than time-dependent.
 *
 * A month-over-month comparison is deliberately absent: a window that ends today
 * is a partial month, and comparing it with a finished one would report a fall
 * that has not happened. Only comparisons that are fair without a second window
 * of data are made here.
 */

const SEVERITY_RANK = { high: 0, medium: 1, low: 2, info: 3 };

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const daysUntil = (dateIso, todayIso) => {
  if (!dateIso || !todayIso) return null;
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(today)) return null;
  return Math.round((target - today) / 86400000);
};

const listNames = (names, limit = 3) => {
  const shown = names.slice(0, limit).join(', ');
  return names.length > limit ? `${shown} and ${names.length - limit} more` : shown;
};

const money = (value, currency) => formatCurrency(Number(value) || 0, currency);

const RETAIL_HOME = '/sales';
const SERVICES_HOME = '/income';

const homeRoute = (mode) => (mode === 'services' ? SERVICES_HOME : RETAIL_HOME);

const reportingRoute = (mode) => (mode === 'services' ? '/service-reporting' : '/reporting');

/**
 * Turns the stats the engine already has into a ranked "needs attention" list.
 *
 * @param {{
 *   mode?: 'retail'|'services',
 *   currency?: string,
 *   statsByScope?: Object,
 *   todayIso?: string,
 * }} context
 * @returns {Array<{
 *   id: string,
 *   severity: 'high'|'medium'|'low'|'info',
 *   title: string,
 *   body: string,
 *   route: string,
 *   action: string,
 * }>}
 */
export const buildInsights = (context = {}) => {
  const mode = context.mode === 'services' ? 'services' : 'retail';
  const currency = context.currency || 'GHS';
  const todayIso = context.todayIso || isoOf(new Date());
  const byScope = context.statsByScope || {};
  const allTime = byScope['all time'] || {};
  const month = byScope['this month'] || {};

  const moneyText = (value) => money(value, currency);
  const insights = [];

  // A business with nothing recorded has exactly one useful thing to be told:
  // where the first record goes. Every other insight would be noise on top of
  // empty data.
  if (!(Number(allTime.incomeCount) || Number(allTime.expenseCount))) {
    const services = mode === 'services';
    return [
      {
        id: 'start',
        severity: 'info',
        title: 'No records yet',
        body: services
          ? 'Add your first payment or expense and this panel will start flagging what needs your attention.'
          : 'Add your first sale or expense and this panel will start flagging what needs your attention.',
        route: homeRoute(mode),
        action: services ? 'Add income' : 'Record a sale',
      },
    ];
  }

  if (mode === 'services') {
    const overdueCount = Number(month.overdueCount) || 0;
    if (overdueCount > 0) {
      const names = Array.isArray(month.overdueCustomers) ? month.overdueCustomers : [];
      const who = names.length ? ` — ${listNames(names)}` : '';
      insights.push({
        id: 'overdue',
        severity: 'high',
        title: 'Overdue invoices',
        body: `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} past due, ${moneyText(month.overdueTotal)} outstanding${who}.`,
        route: '/service-outstanding',
        action: 'See who owes you',
      });
    } else if (Number(month.outstandingTotal) > 0) {
      insights.push({
        id: 'outstanding',
        severity: 'low',
        title: 'Unpaid invoices',
        body: `${moneyText(month.outstandingTotal)} is still owed to you, none past due yet.`,
        route: '/service-outstanding',
        action: 'See who owes you',
      });
    }

    const next = month.nextRecurring;
    const dueIn = next ? daysUntil(next.nextDueDate, todayIso) : null;
    if (next && dueIn !== null && dueIn <= 7) {
      const when = dueIn < 0 ? 'is overdue' : dueIn === 0 ? 'is due today' : `is due in ${dueIn} day${dueIn === 1 ? '' : 's'}`;
      insights.push({
        id: 'recurring-due',
        severity: dueIn <= 0 ? 'medium' : 'low',
        title: 'Recurring payment due',
        body: `${next.clientName} ${when} — ${moneyText(next.amount)}.`,
        route: SERVICES_HOME,
        action: 'Open income',
      });
    }
  }

  if (mode === 'retail') {
    const lowStock = Array.isArray(month.lowStock) ? month.lowStock : [];
    const out = lowStock.filter((item) => Number(item.stock) <= 0);
    const low = lowStock.filter((item) => Number(item.stock) > 0);

    if (out.length) {
      insights.push({
        id: 'stock-out',
        severity: 'high',
        title: 'Out of stock',
        body: `${listNames(out.map((item) => item.name))} — nothing left to sell.`,
        route: '/inventory',
        action: 'Restock now',
      });
    }

    if (low.length) {
      insights.push({
        id: 'low-stock',
        severity: 'medium',
        title: 'Running low',
        body: `${listNames(low.map((item) => item.name))} at or below the reorder level.`,
        route: '/inventory',
        action: 'Open inventory',
      });
    }

    if (Number(month.unpricedCount) > 0) {
      insights.push({
        id: 'unpriced',
        severity: 'low',
        title: 'Missing cost prices',
        body: `${month.unpricedCount} item${Number(month.unpricedCount) === 1 ? '' : 's'} have no cost price, so your margin can't be worked out.`,
        route: '/inventory',
        action: 'Open inventory',
      });
    }
  }

  // Both modes: a month running at a loss, and a month that has gone quiet.
  const netOut = Number(month.profit) < 0 && (Number(month.incomeCount) || Number(month.expenseCount));
  if (netOut) {
    insights.push({
      id: 'in-the-red',
      severity: 'medium',
      title: 'Spending more than you earned',
      body: `This month: ${moneyText(month.incomeTotal)} in, ${moneyText(month.expenseTotal)} out — ${moneyText(Math.abs(Number(month.profit)))} in the red.`,
      route: reportingRoute(mode),
      action: 'See the numbers',
    });
  }

  const nothingThisMonth =
    (Number(allTime.incomeCount) || Number(allTime.expenseCount)) &&
    !Number(month.incomeCount) &&
    !Number(month.expenseCount);
  if (nothingThisMonth) {
    insights.push({
      id: 'quiet-month',
      severity: 'low',
      title: 'Nothing recorded this month',
      body: mode === 'services' ? 'No payments or expenses logged this month yet.' : 'No sales or expenses logged this month yet.',
      route: homeRoute(mode),
      action: mode === 'services' ? 'Add income' : 'Record a sale',
    });
  }

  return insights.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
};

/**
 * The insight the panel should shout about first, if any — used to decide
 * whether the surface has anything worth showing without rendering the list.
 */
export const topSeverity = (insights = []) =>
  insights.reduce((worst, insight) => {
    if (!worst) return insight.severity;
    return (SEVERITY_RANK[insight.severity] ?? 9) < (SEVERITY_RANK[worst] ?? 9) ? insight.severity : worst;
  }, null);
