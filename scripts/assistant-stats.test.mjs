import test from 'node:test';
import assert from 'node:assert/strict';

import { scopeWindows, buildStatsByScope, buildProjection, SCOPE_KEYS } from '../src/utils/assistant/stats.js';

const TODAY = '2026-10-07';
const money = (n) => `GHS ${n.toFixed(2)}`;

const retailRecords = (overrides = {}) => ({
  mode: 'retail',
  todayIso: TODAY,
  sales: [
    { date: '2026-10-07', amount: money(100) },
    { date: '2026-09-30', amount: money(600) },
    { date: '2026-03-15', amount: money(50) },
  ],
  expenses: [
    { date: '2026-10-01', amount: money(30) },
    { date: '2026-09-01', amount: money(20) },
  ],
  inventory: [],
  customers: [],
  serviceIncome: [],
  recurring: [],
  invoices: [],
  ...overrides,
});

const servicesRecords = (overrides = {}) => ({
  mode: 'services',
  todayIso: TODAY,
  sales: [],
  serviceIncome: [
    {
      clientName: 'Ama',
      category: 'Design',
      paymentDate: '2026-10-05',
      amount: money(500),
      platformFee: money(50),
      netAmount: money(450),
    },
    {
      clientName: 'Kojo',
      category: 'Mentoring',
      paymentDate: '2026-09-20',
      amount: money(200),
      platformFee: money(0),
      netAmount: money(200),
    },
  ],
  expenses: [
    { date: '2026-10-01', category: 'Software', amount: money(80) },
    { date: '2026-09-01', category: 'Travel', amount: money(40) },
  ],
  inventory: [],
  customers: [],
  recurring: [],
  invoices: [],
  ...overrides,
});

test('scopeWindows builds the six requested windows in UTC', () => {
  const windows = scopeWindows(TODAY);
  assert.deepEqual(windows.map((w) => w.key), SCOPE_KEYS);
  const byKey = Object.fromEntries(windows.map((w) => [w.key, w]));
  assert.equal(byKey['today'].startIso, TODAY);
  assert.equal(byKey['today'].endIso, TODAY);
  assert.equal(byKey['this week'].startIso, '2026-10-01');
  assert.equal(byKey['this month'].startIso, '2026-10-01');
  assert.equal(byKey['last month'].startIso, '2026-09-01');
  assert.equal(byKey['last month'].endIso, '2026-09-30');
  assert.equal(byKey['this year'].startIso, '2026-01-01');
  assert.equal(byKey['all time'].startIso, '');
  assert.equal(byKey['all time'].endIso, TODAY);
});

test('retail: totals are scoped to the window and round-trip money text', () => {
  const stats = buildStatsByScope(retailRecords());
  assert.equal(stats['this month'].incomeTotal, 100);
  assert.equal(stats['this month'].incomeCount, 1);
  assert.equal(stats['this month'].expenseTotal, 30);
  assert.equal(stats['this month'].profit, 70);
  assert.equal(stats['all time'].incomeTotal, 750);
  assert.equal(stats['all time'].incomeCount, 3);
  assert.equal(stats['all time'].expenseTotal, 50);
  assert.equal(stats['all time'].profit, 700);
});

test('retail: last month is a complete calendar month', () => {
  const stats = buildStatsByScope(retailRecords());
  assert.equal(stats['last month'].incomeTotal, 600);
  assert.equal(stats['last month'].expenseTotal, 20);
  assert.equal(stats['last month'].profit, 580);
});

test('services: income is net of platform fees, profit via serviceProfit', () => {
  const stats = buildStatsByScope(servicesRecords());
  assert.equal(stats['this month'].incomeTotal, 450);
  assert.equal(stats['this month'].incomeCount, 1);
  assert.equal(stats['this month'].expenseTotal, 80);
  assert.equal(stats['this month'].profit, 370);
  assert.equal(stats['all time'].incomeTotal, 650);
  assert.equal(stats['all time'].profit, 530);
});

test('services: top customer is ranked by income received', () => {
  const stats = buildStatsByScope(servicesRecords());
  assert.deepEqual(stats['all time'].topCustomer, { name: 'Ama', total: 450 });
});

test('categories: expense top and income top come from the window only', () => {
  const stats = buildStatsByScope(servicesRecords());
  assert.deepEqual(stats['this month'].expenseTopCategory, { name: 'Software', total: 80 });
  assert.deepEqual(stats['last month'].expenseTopCategory, { name: 'Travel', total: 40 });
  assert.deepEqual(stats['this month'].incomeTopCategory, { name: 'Design', total: 450 });
});

test('retail: no incomeTopCategory is ever produced', () => {
  const stats = buildStatsByScope(retailRecords());
  assert.equal(stats['this month'].incomeTopCategory, null);
});

test('low stock flags items at or below the reorder level, defaulting to 5', () => {
  const stats = buildStatsByScope(
    retailRecords({
      inventory: [
        { name: 'Rice', stock: 3, minStock: 5 },
        { name: 'Palm Oil', stock: 1 },
        { name: 'Cocoa', stock: 8, minStock: 5 },
        { name: 'Empty Shelf', stock: 0, minStock: 2 },
      ],
    })
  );
  assert.equal(stats['this month'].inventoryCount, 4);
  assert.deepEqual(stats['this month'].lowStock, [
    { name: 'Rice', stock: 3, minStock: 5 },
    { name: 'Palm Oil', stock: 1, minStock: 5 },
    { name: 'Empty Shelf', stock: 0, minStock: 2 },
  ]);
});

test('outstanding uses buildOutstandingRows: settled invoices are excluded', () => {
  const records = servicesRecords({
    invoices: [
      { id: 1, customer: 'Ama', amount: money(300), status: 'Pending', date: '2026-09-01' },
      { id: 2, customer: 'Kojo', amount: money(200), status: 'paid', date: '2026-08-01' },
    ],
  });
  const stats = buildStatsByScope(records);
  assert.equal(stats['this month'].outstandingTotal, 300);
  assert.deepEqual(stats['this month'].outstandingByCustomer, [
    { name: 'Ama', count: 1, total: 300, oldest: '2026-09-01' },
  ]);
});

test('overdue counts only dated unpaid items in the past', () => {
  const records = servicesRecords({
    invoices: [
      { id: 1, customer: 'Ama', amount: money(400), status: 'Pending', date: '2026-09-01' },
      { id: 2, customer: 'Kojo', amount: money(100), status: 'Pending', date: '2026-10-20' },
      { id: 3, customer: 'Adwoa', amount: money(50), status: 'Pending' },
    ],
  });
  const stats = buildStatsByScope(records);
  assert.equal(stats['this month'].overdueCount, 1);
  assert.equal(stats['this month'].overdueTotal, 400);
  assert.deepEqual(stats['this month'].overdueCustomers, ['Ama']);
});

test('recurring counts only active items and predicts the next due', () => {
  const records = servicesRecords({
    recurring: [
      { clientName: 'Ama', amount: 200, frequency: 'monthly', nextDueDate: '2026-11-01', active: true },
      { clientName: 'Kojo', amount: 900, frequency: 'yearly', nextDueDate: '2026-10-10', active: false },
      { clientName: 'Esi', amount: 300, frequency: 'quarterly', nextDueDate: '2026-10-08', active: true },
    ],
  });
  const stats = buildStatsByScope(records);
  assert.equal(stats['this month'].recurringCount, 2);
  assert.deepEqual(stats['this month'].nextRecurring, { clientName: 'Esi', amount: 300, nextDueDate: '2026-10-08' });
});

test('empty records produce zeroed stats, not errors', () => {
  const stats = buildStatsByScope({ mode: 'services', todayIso: TODAY });
  const month = stats['this month'];
  assert.equal(month.incomeTotal, 0);
  assert.equal(month.incomeCount, 0);
  assert.equal(month.profit, 0);
  assert.equal(month.customerCount, 0);
  assert.deepEqual(month.lowStock, []);
  assert.equal(month.outstandingTotal, 0);
  assert.equal(month.recurringCount, 0);
  assert.equal(month.nextRecurring, null);
});

test('all scope keys exist for every business mode', () => {
  for (const mode of ['retail', 'services']) {
    const stats = buildStatsByScope({ mode, todayIso: TODAY });
    for (const key of SCOPE_KEYS) {
      assert.ok(stats[key], `${mode}/${key} should exist`);
      assert.equal(typeof stats[key].profit, 'number');
    }
  }
});

test('projection averages this year income over its active months', () => {
  const { yearTotal, activeMonths, monthlyAverageIncome } = buildProjection(retailRecords());
  assert.equal(yearTotal, 750);
  assert.equal(activeMonths, 8);
  assert.equal(monthlyAverageIncome, 93.75);
});

test('projection: services measures what was actually received', () => {
  const { yearTotal, activeMonths, monthlyAverageIncome } = buildProjection(servicesRecords());
  assert.equal(yearTotal, 650);
  assert.equal(activeMonths, 2);
  assert.equal(monthlyAverageIncome, 325);
});

test('projection: a business that started this month uses only its own month', () => {
  const { yearTotal, activeMonths, monthlyAverageIncome } = buildProjection({
    mode: 'services',
    todayIso: TODAY,
    serviceIncome: [
      { paymentDate: '2026-10-02', amount: money(823), platformFee: money(0), netAmount: money(823) },
    ],
  });
  assert.equal(yearTotal, 823);
  assert.equal(activeMonths, 1);
  assert.equal(monthlyAverageIncome, 823);
});

test('projection: no income this year means no projection', () => {
  assert.deepEqual(buildProjection({ mode: 'retail', todayIso: TODAY }), {
    monthlyAverageIncome: 0,
    activeMonths: 0,
    yearTotal: 0,
  });
  const lastYear = buildProjection({
    mode: 'retail',
    todayIso: TODAY,
    sales: [{ date: '2025-12-01', amount: money(90) }],
  });
  assert.equal(lastYear.monthlyAverageIncome, 0);
});