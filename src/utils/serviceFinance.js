import { parseAmount } from './currency.js';

/**
 * Single source of truth for services profit arithmetic.
 *
 * The dashboard and the P&L report previously defined "net" differently: the
 * dashboard subtracted expenses from GROSS income and ignored platform fees,
 * while the report subtracted expenses from income NET of fees. The two pages
 * therefore disagreed by exactly the platform fees, even though both were
 * internally consistent. Both now call these helpers so they cannot drift again.
 *
 * Basis: platform fees are money that left the business before the owner saw
 * it, so profit is measured on income RECEIVED (net of fees), never on gross.
 */

/** Gross billed income, before any platform fee. */
export const serviceGross = (rows = []) =>
  rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);

/** Total taken by platforms on the income above. */
export const serviceFees = (rows = []) =>
  rows.reduce((sum, row) => sum + parseAmount(row.platformFee), 0);

/**
 * Income actually received for a single row.
 *
 * net_amount is a nullable column with DEFAULT 0, so a stored 0 means "never
 * computed" rather than "nothing was received" — real rows exist with
 * amount = 1.00, platform_fee = 0 and net_amount = 0. The falsy check below
 * therefore matches the `i.netAmount || i.amount` fallback the rest of the
 * reporting code already uses, keeping every total on one identical basis.
 */
export const serviceRowReceived = (row = {}) => {
  const net = row.netAmount;
  return net === null || net === undefined || net === '' || parseAmount(net) === 0
    ? parseAmount(row.amount)
    : parseAmount(net);
};

/** Income actually received across many rows. */
export const serviceReceived = (rows = []) =>
  rows.reduce((sum, row) => sum + serviceRowReceived(row), 0);

/** Expenses are stored as prefixed TEXT, so they must go through parseAmount. */
export const serviceExpenses = (rows = []) =>
  rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);

/**
 * Profit = income received - expenses. This is the figure both the dashboard and
 * the P&L report must show. `margin` is null when there is no income, rather than
 * a misleading 0%.
 */
export const serviceProfit = (income = [], expenses = []) => {
  const gross = serviceGross(income);
  const fees = serviceFees(income);
  const received = serviceReceived(income);
  const spent = serviceExpenses(expenses);
  const profit = received - spent;
  return {
    gross,
    fees,
    received,
    expenses: spent,
    profit,
    margin: received > 0 ? ((profit / received) * 100).toFixed(1) : null,
  };
};