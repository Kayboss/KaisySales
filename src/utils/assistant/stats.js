import { parseAmount } from '../currency.js';
import { serviceRowReceived, serviceProfit } from '../serviceFinance.js';
import { buildOutstandingRows, summariseByCustomer, isOverdue } from '../serviceOutstanding.js';
import { resolveStock, resolveMinStock } from '../inventory.js';

/**
 * Assistant stats builder.
 *
 * The assistant engine only words numbers; this module is where those numbers
 * get computed. Every figure is produced by the SAME pure helpers the dashboards
 * use (serviceProfit, buildOutstandingRows, summariseByCustomer, countOverdue,
 * inventory), so the assistant and the reports can never disagree.
 *
 * Pure and import-light, so it can be unit tested in plain Node.
 */

export const SCOPE_KEYS = ['today', 'this week', 'this month', 'last month', 'this year', 'all time'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * Inclusive [startIso, endIso] windows per scope, derived in UTC so day math is
 * never touched by local-timezone drift. `all time` has an empty lower bound,
 * which the filters below interpret as "no floor".
 */
export const scopeWindows = (todayIso) => {
  const [y, m, d] = todayIso.split('-').map(Number);
  const weekStart = new Date(Date.UTC(y, m - 1, d - 6));
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const prevEnd = new Date(Date.UTC(y, m - 1, 0));
  return [
    { key: 'today', startIso: todayIso, endIso: todayIso },
    { key: 'this week', startIso: isoOf(weekStart), endIso: todayIso },
    { key: 'this month', startIso: ymd(y, m, 1), endIso: todayIso },
    { key: 'last month', startIso: isoOf(prev), endIso: isoOf(prevEnd) },
    { key: 'this year', startIso: ymd(y, 1, 1), endIso: todayIso },
    { key: 'all time', startIso: '', endIso: todayIso },
  ];
};

const inWindow = (dateIso, windowData) => {
  if (!dateIso) return false;
  if (windowData.startIso && dateIso < windowData.startIso) return false;
  if (dateIso > windowData.endIso) return false;
  return true;
};

const sum = (list) => list.reduce((total, value) => total + value, 0);

const groupTop = (rows, keyOf, valueOf) => {
  const totals = new Map();
  rows.forEach((row) => {
    const key = String(keyOf(row)).trim();
    if (!key) return;
    totals.set(key, (totals.get(key) || 0) + valueOf(row));
  });
  let top = null;
  for (const [name, total] of totals) {
    if (!top || total > top.total) top = { name, total };
  }
  return top;
};

const emptyStats = () => ({
  incomeTotal: 0,
  incomeCount: 0,
  expenseTotal: 0,
  expenseCount: 0,
  profit: 0,
  inventoryCount: 0,
  lowStock: [],
  customerCount: 0,
  topCustomer: null,
  outstandingTotal: 0,
  outstandingByCustomer: [],
  overdueCount: 0,
  overdueTotal: 0,
  overdueCustomers: [],
  recurringCount: 0,
  nextRecurring: null,
  expenseTopCategory: null,
  incomeTopCategory: null,
});

const allTimeFacts = ({ mode, inventory, customers, serviceIncome, recurring, invoices }, todayIso) => {
  const lowStock = inventory
    .filter((item) => resolveStock(item) <= resolveMinStock(item))
    .map((item) => ({ name: item.name, stock: resolveStock(item), minStock: resolveMinStock(item) }))
    .filter((item) => item.name);

  const outstandingRows = mode === 'services' ? buildOutstandingRows(invoices, serviceIncome) : [];
  const byCustomer = summariseByCustomer(outstandingRows);
  const overdueRows = outstandingRows.filter((row) => isOverdue(row, todayIso));

  const activeRecurring = recurring.filter((item) => item.active !== false);
  const due = activeRecurring
    .filter((item) => item.nextDueDate)
    .sort((a, b) => String(a.nextDueDate).localeCompare(String(b.nextDueDate)));
  const nextRecurring = due.find((item) => item.nextDueDate >= todayIso) || due[0] || null;

  return {
    inventoryCount: inventory.length,
    lowStock,
    customerCount: customers.length,
    topCustomer: groupTop(serviceIncome, (i) => i.clientName || 'Unnamed client', serviceRowReceived),
    outstandingTotal: sum(byCustomer.map((row) => row.total)),
    outstandingByCustomer: byCustomer,
    overdueCount: overdueRows.length,
    overdueTotal: sum(overdueRows.map((row) => row.balance)),
    overdueCustomers: [...new Set(overdueRows.map((row) => row.customer))].slice(0, 5),
    recurringCount: activeRecurring.length,
    nextRecurring: nextRecurring
      ? { clientName: nextRecurring.clientName, amount: parseAmount(nextRecurring.amount), nextDueDate: nextRecurring.nextDueDate }
      : null,
  };
};

/**
 * Builds the full `statsByScope` object the assistant engine consumes.
 *
 * @param {{
 *   mode: 'retail'|'services',
 *   todayIso?: string,
 *   sales?: Array<Object>,
 *   serviceIncome?: Array<Object>,
 *   expenses?: Array<Object>,
 *   inventory?: Array<Object>,
 *   customers?: Array<Object>,
 *   recurring?: Array<Object>,
 *   invoices?: Array<Object>,
 * }} records
 * @returns {Object} stats keyed by scope key.
 */
export const buildStatsByScope = (records = {}) => {
  const mode = records.mode === 'services' ? 'services' : 'retail';
  const todayIso = records.todayIso || new Date().toISOString().slice(0, 10);
  const {
    sales = [],
    serviceIncome = [],
    expenses = [],
    inventory = [],
    customers = [],
    recurring = [],
    invoices = [],
  } = records;

  const shared = allTimeFacts({ mode, inventory, customers, serviceIncome, recurring, invoices }, todayIso);
  const windows = scopeWindows(todayIso);

  const salesOf = sales.map((s) => ({
    date: s.date,
    amount: parseAmount(s.amount || s.totalAmount),
  }));
  const incomeOf = serviceIncome.map((i) => ({
    row: i,
    date: i.paymentDate,
    amount: serviceRowReceived(i),
  }));
  const expenseOf = expenses.map((e) => ({ row: e, date: e.date, amount: parseAmount(e.amount) }));

  const statsByScope = {};
  for (const windowData of windows) {
    const inWindowSales = salesOf.filter((s) => inWindow(s.date, windowData));
    const inWindowIncome = incomeOf.filter((i) => inWindow(i.date, windowData));
    const inWindowExpenses = expenseOf.filter((e) => inWindow(e.date, windowData));

    const incomeTotal = sum(inWindowIncome.map((i) => i.amount)) + sum(inWindowSales.map((s) => s.amount));
    const incomeCount = inWindowIncome.length + inWindowSales.length;
    const expenseTotal = sum(inWindowExpenses.map((e) => e.amount));

    const retailProfit = sum(inWindowSales.map((s) => s.amount)) - expenseTotal;
    const serviceResult = serviceProfit(
      inWindowIncome.map((i) => i.row),
      inWindowExpenses.map((e) => e.row)
    );

    statsByScope[windowData.key] = {
      ...emptyStats(),
      ...shared,
      incomeTotal: mode === 'services' ? serviceResult.received : incomeTotal,
      incomeCount,
      expenseTotal: mode === 'services' ? serviceResult.expenses : expenseTotal,
      expenseCount: inWindowExpenses.length,
      profit: mode === 'services' ? serviceResult.profit : retailProfit,
      expenseTopCategory: groupTop(inWindowExpenses, (e) => e.row.category || 'Uncategorised', (e) => e.amount),
      incomeTopCategory:
        mode === 'services'
          ? groupTop(inWindowIncome, (i) => i.row.category, (i) => i.amount)
          : null,
    };
  }

  return statsByScope;
};