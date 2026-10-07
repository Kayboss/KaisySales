import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answer,
  classifyIntent,
  normalizeQuestion,
  suggestedQuestions,
} from '../src/utils/assistant/engine.js';

const moneyish = (text) =>
  text
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'");

const stats = (overrides = {}) => ({
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
  ...overrides,
});

const retail = (byScope = {}) => ({
  mode: 'retail',
  currency: 'GHS',
  statsByScope: { 'this month': stats(byScope) },
});

const services = (byScope = {}) => ({
  mode: 'services',
  currency: 'GHS',
  statsByScope: { 'this month': stats(byScope) },
});

test('normalizeQuestion strips punctuation, case and extra whitespace', () => {
  assert.equal(normalizeQuestion('How DID   I *MAKE* money??'), 'how did i make money');
  assert.equal(normalizeQuestion(''), '');
});

test('classifyIntent: income with an explicit scope', () => {
  assert.deepEqual(classifyIntent('how much did i make this month'), {
    intent: 'income',
    scope: 'this month',
    raw: 'how much did i make this month',
  });
  assert.equal(classifyIntent('how much did i earn today').scope, 'today');
  assert.equal(classifyIntent('what is my revenue this year').intent, 'income');
  assert.equal(classifyIntent('how much did i make in total').scope, 'all time');
});

test('classifyIntent defaults to this month when no scope is mentioned', () => {
  assert.equal(classifyIntent('how much did i make').scope, 'this month');
});

test('classifyIntent: expenses', () => {
  const { intent, scope } = classifyIntent('how much did i spend last month');
  assert.equal(intent, 'expenses');
  assert.equal(scope, 'last month');
  assert.equal(classifyIntent('what are my expenses').intent, 'expenses');
  assert.equal(classifyIntent('how much am i spending').intent, 'expenses');
});

test('classifyIntent: profit wording', () => {
  assert.equal(classifyIntent('did i make a profit last month').intent, 'profit');
  assert.equal(classifyIntent('am i losing money').intent, 'profit');
  assert.equal(classifyIntent('what is my net income this week').intent, 'profit');
  assert.equal(classifyIntent('how is my margin').intent, 'profit');
});

test('classifyIntent: stock wording', () => {
  assert.equal(classifyIntent('is anything running low').intent, 'stock');
  assert.equal(classifyIntent('do i need to reorder stock').intent, 'stock');
  assert.equal(classifyIntent("what's in my inventory").intent, 'stock');
});

test('classifyIntent: customers', () => {
  assert.equal(classifyIntent('who is my best customer').intent, 'customers');
  assert.equal(classifyIntent('show me my clients').intent, 'customers');
});

test('classifyIntent: outstanding and overdue are separate', () => {
  assert.equal(classifyIntent('who owes me money').intent, 'outstanding');
  assert.equal(classifyIntent('what is still unpaid').intent, 'outstanding');
  assert.equal(classifyIntent('are any invoices overdue').intent, 'overdue');
  assert.equal(classifyIntent('past due invoices').intent, 'overdue');
});

test('classifyIntent: recurring income', () => {
  assert.equal(classifyIntent('how much recurring income do i have').intent, 'recurring');
  assert.equal(classifyIntent('show my monthly subscriptions').intent, 'recurring');
});

test('classifyIntent: greeting, thanks, help', () => {
  assert.equal(classifyIntent('hello').intent, 'greeting');
  assert.equal(classifyIntent('hey there').intent, 'greeting');
  assert.equal(classifyIntent('thanks a lot').intent, 'thanks');
  assert.equal(classifyIntent('what can you do').intent, 'help');
});

test('classifyIntent: overview', () => {
  assert.equal(classifyIntent('how is my business doing today').intent, 'overview');
  assert.equal(classifyIntent('give me a summary').intent, 'overview');
  assert.equal(classifyIntent('what should I know today').intent, 'overview');
});

test('classifyIntent: how do i ... is a howto, not a data question', () => {
  assert.equal(classifyIntent('how do i record a sale').intent, 'howto');
  assert.equal(classifyIntent('how do i add a client').intent, 'howto');
  assert.equal(classifyIntent('explain how expenses work').intent, 'howto');
});

test('classifyIntent: projections are their own intent', () => {
  const { intent, scope } = classifyIntent('can you make a projection for the next 5 months');
  assert.equal(intent, 'projection');
  assert.equal(classifyIntent('what are my sales projected to be next quarter').intent, 'projection');
  assert.equal(classifyIntent('predict my income for the next 3 months').intent, 'projection');
  assert.equal(classifyIntent('forecast my revenue').intent, 'projection');
});

test('classifyIntent: data import beats the generic help intent', () => {
  assert.equal(classifyIntent('can you help upload data').intent, 'dataImport');
  assert.equal(classifyIntent('how do i import my data').intent, 'dataImport');
  assert.equal(classifyIntent('import csv').intent, 'dataImport');
  assert.equal(classifyIntent('where can i upload a spreadsheet').intent, 'dataImport');
});

test('classifyIntent: a reported sale is guidance, not an income question', () => {
  assert.equal(classifyIntent('i made a sale today for classic touch').intent, 'recordOne');
  assert.equal(classifyIntent('i sold to classic touch').intent, 'recordOne');
  assert.equal(classifyIntent('we got paid by classic touch').intent, 'recordOne');
  assert.equal(classifyIntent('just received a payment from amma').intent, 'recordOne');
  assert.equal(classifyIntent('i took in 500 today').intent, 'recordOne');
  assert.equal(classifyIntent('how much did i make').intent, 'income');
  assert.equal(classifyIntent('i made a profit last month').intent, 'profit');
});

test('classifyIntent: guide me is a howto, not unknown', () => {
  assert.equal(classifyIntent('can you guide me to input it').intent, 'howto');
  assert.equal(classifyIntent('show me how to record a sale').intent, 'howto');
  assert.equal(classifyIntent('walk me through adding income').intent, 'howto');
});

test('classifyIntent: unknown falls through', () => {
  assert.equal(classifyIntent('what is your favorite color').intent, 'unknown');
  assert.equal(classifyIntent('tell me a joke').intent, 'unknown');
});

test('answer: income reports total, count and average (retail)', () => {
  const { text } = answer('how much did i make', retail({ incomeTotal: 3400, incomeCount: 12 }));
  const t = moneyish(text);
  assert.match(t, /GHS 3,400\.00/);
  assert.match(t, /12 sales/);
  assert.match(t, /this month/);
  assert.match(t, /GHS 283\.33 each/);
});

test('answer: services mode words income as payments', () => {
  const { text } = answer('how much did i make', services({ incomeTotal: 800, incomeCount: 3 }));
  assert.match(moneyish(text), /3 payments/);
});

test('answer: income with no records is honest about the gap', () => {
  const { text } = answer('how much did i make this month', retail({}));
  assert.match(moneyish(text), /haven't recorded any income this month yet/);
});

test('answer: profit when running a profit', () => {
  const { text } = answer(
    'did i make a profit',
    services({ incomeTotal: 1000, expenseTotal: 400, profit: 600 })
  );
  const t = moneyish(text);
  assert.match(t, /GHS 600\.00 to the good/);
});

test('answer: profit when running a loss', () => {
  const { text } = answer(
    'am i losing money',
    services({ incomeTotal: 1000, expenseTotal: 1500, profit: -500 })
  );
  const t = moneyish(text);
  assert.match(t, /GHS 500\.00 in the red/);
  assert.match(t, /GHS 1,500\.00/);
  assert.match(t, /GHS 1,000\.00/);
});

test('answer: expenses report total, count and top category', () => {
  const { text } = answer(
    'how much did i spend last month',
    retail({
      expenseTotal: 950,
      expenseCount: 6,
      expenseTopCategory: { name: 'Rent', total: 600 },
    })
  );
  const t = moneyish(text);
  assert.match(t, /GHS 950\.00/);
  assert.match(t, /6 expenses/);
  assert.match(t, /Rent at GHS 600\.00/);
});

test('answer: low stock lists names with count and threshold', () => {
  const { text } = answer(
    'is anything running low',
    retail({
      inventoryCount: 8,
      lowStock: [
        { name: 'Rice', stock: 3, minStock: 5 },
        { name: 'Palm Oil', stock: 1 },
      ],
    })
  );
  assert.match(text, /Running low: Rice — 3 left \(min 5\), Palm Oil — 1 left/);
});

test('answer: stock with nothing low says so and reports the count', () => {
  const { text } = answer(
    "what's my stock looking like",
    retail({ inventoryCount: 8, lowStock: [] })
  );
  assert.match(text, /Nothing is running low right now/);
  assert.match(text, /8 items on your shelf/);
});

test('answer: stock with no inventory points to setup', () => {
  const { text } = answer('restock check', retail({}));
  assert.match(moneyish(text), /don't have any inventory yet/);
});

test('answer: outstanding lists who still owes', () => {
  const { text } = answer(
    'who owes me money',
    services({
      outstandingTotal: 1200,
      outstandingByCustomer: [
        { name: 'Ama', total: 700 },
        { name: 'Kojo', total: 500 },
      ],
    })
  );
  const t = moneyish(text);
  assert.match(t, /GHS 1,200\.00 is owed to you in total/);
  assert.match(t, /Ama still owes GHS 700\.00/);
  assert.match(t, /Kojo still owes GHS 500\.00/);
});

test('answer: outstanding with everything settled', () => {
  const { text } = answer('unpaid invoices', services({}));
  assert.match(text, /Nothing is outstanding/);
});

test('answer: overdue reports count and total', () => {
  const { text } = answer(
    'are any invoices overdue',
    services({ overdueCount: 2, overdueTotal: 800, overdueCustomers: ['Ama', 'Kojo'] })
  );
  const t = moneyish(text);
  assert.match(t, /2 invoices overdue, totalling GHS 800\.00/);
  assert.match(t, /Ama, Kojo/);
});

test('answer: customers features the top client', () => {
  const { text } = answer(
    'who is my best customer',
    services({ customerCount: 3, topCustomer: { name: 'Ama', total: 5000 } })
  );
  const t = moneyish(text);
  assert.match(t, /3 customers on file/);
  assert.match(t, /Ama at GHS 5,000\.00/);
});

test('answer: recurring income names the next payment', () => {
  const { text } = answer(
    'show my recurring income',
    services({
      recurringCount: 2,
      nextRecurring: { clientName: 'Tolu', amount: 400, nextDueDate: '2026-11-01' },
    })
  );
  const t = moneyish(text);
  assert.match(t, /2 recurring income items/);
  assert.match(t, /Tolu for GHS 400\.00 on 2026-11-01/);
});

test('answer: spend-on-most category', () => {
  const { text } = answer(
    'what do i spend the most on',
    retail({ expenseTopCategory: { name: 'Rent', total: 950 } })
  );
  const t = moneyish(text);
  assert.match(t, /Most of your spending went on Rent \(GHS 950\.00\)/);
});

test('answer: income source category', () => {
  const { text } = answer(
    'where does my income come from',
    services({ incomeTopCategory: { name: 'Freelance', total: 3000 } })
  );
  const t = moneyish(text);
  assert.match(t, /Most of your income came from Freelance \(GHS 3,000\.00\)/);
});

test('answer: overview blends mode-appropriate facts', () => {
  const { text } = answer(
    'how is my business doing',
    services({
      incomeTotal: 2000,
      incomeCount: 5,
      expenseTotal: 700,
      profit: 1300,
      outstandingTotal: 400,
      recurringCount: 1,
    })
  );
  const t = moneyish(text);
  assert.match(t, /GHS 2,000\.00 across 5 payments/);
  assert.match(t, /GHS 700\.00/);
  assert.match(t, /GHS 1,300\.00/);
  assert.match(t, /GHS 400\.00 is still owed/);
});

test('answer: overview includes a low-stock warning for retail', () => {
  const { text } = answer(
    'what should i know today',
    retail({
      incomeTotal: 2000,
      incomeCount: 5,
      expenseTotal: 700,
      profit: 1300,
      lowStock: [{ name: 'Rice', stock: 2, minStock: 5 }],
    })
  );
  assert.match(text, /Running low: Rice — 2 left \(min 5\)/);
});

test('answer: howto gives an actionable sales walkthrough', () => {
  const { text } = answer('how do i record a sale', retail({}));
  assert.match(text, /Record sale/);
  assert.match(text, /moves that stock automatically/);
});

test('answer: howto falls back gracefully for unknown topics', () => {
  const { text } = answer('how do i do my taxes', retail({}));
  assert.match(text, /Pick what you want help with/);
});

test('answer: unknown gives suggestions scoped to the mode', () => {
  const { text, intent } = answer('tell me a joke', services({}));
  assert.equal(intent, 'unknown');
  assert.match(text, /Who owes me money\?/);
  assert.match(text, /How much did I make this month\?/);
});

test('answer: help lists example questions', () => {
  const { text } = answer('what can you do', retail({}));
  assert.match(text, /Who owes me money\?/);
  assert.match(text, /Is anything running low\?/);
});

test('answer: greeting promises local-only processing', () => {
  const { text } = answer('hello', retail({}));
  assert.match(text, /nothing leaves this device/);
});

test('answer: numbers come only from the supplied stats, never recomputed', () => {
  const { text } = answer(
    'how much did i make',
    retail({ incomeTotal: 999, incomeCount: 1 })
  );
  assert.match(moneyish(text), /GHS 999\.00/);
});

test('answer: projection scales only the handed monthly average', () => {
  const { text, intent } = answer('can you make a projection for the next 5 months', {
    mode: 'services',
    currency: 'GHS',
    statsByScope: { 'this month': stats({}) },
    projection: { monthlyAverageIncome: 1200, activeMonths: 3, yearTotal: 3600 },
  });
  assert.equal(intent, 'projection');
  const t = moneyish(text);
  assert.match(t, /GHS 1,200\.00 a month/);
  assert.match(t, /next 5 months/);
  assert.match(t, /GHS 6,000\.00/);
  assert.match(t, /not a promise/);
});

test('answer: projection figures come only from the handed stats', () => {
  const { text } = answer('what should i make in the next 2 months', {
    mode: 'services',
    currency: 'GHS',
    statsByScope: { 'this month': stats({}) },
    projection: { monthlyAverageIncome: 999.75, activeMonths: 2, yearTotal: 1999.5 },
  });
  const t = moneyish(text);
  assert.match(t, /GHS 999\.75 a month/);
  assert.match(t, /GHS 1,999\.50/);
});

test('answer: projection with a single active month phrases it as so-far', () => {
  const { text } = answer('make a 6 month projection', {
    mode: 'retail',
    currency: 'GHS',
    statsByScope: { 'this month': stats({}) },
    projection: { monthlyAverageIncome: 823, activeMonths: 1, yearTotal: 823 },
  });
  assert.match(moneyish(text), /so far this year/);
  assert.match(moneyish(text), /next 6 months/);
  assert.match(moneyish(text), /GHS 4,938\.00/);
});

test('answer: projection with no recorded income is honest', () => {
  const { text } = answer('can you make a projection', {
    mode: 'services',
    currency: 'GHS',
    statsByScope: { 'this month': stats({}) },
    projection: { monthlyAverageIncome: 0, activeMonths: 0, yearTotal: 0 },
  });
  assert.match(moneyish(text), /nothing to project from/);
});

test('answer: data import points at Settings to Import Data', () => {
  const { text, intent } = answer('can you help upload data', retail({}));
  assert.equal(intent, 'dataImport');
  assert.match(text, /Settings/);
  assert.match(text, /Import Data/);
  assert.match(text, /CSV/);
});

test('answer: a reported sale points at the entry screen and names the client', () => {
  const { text, intent } = answer('i made a sale today for Classic Touch', services({}));
  assert.equal(intent, 'recordOne');
  assert.match(text, /Classic Touch/);
  assert.match(text, /Add Income/);
  const retailText = answer('i made a sale today for Classic Touch', retail({})).text;
  assert.match(retailText, /Record sale/);
  assert.match(retailText, /Classic Touch/);
});

test('answer: a reported sale without a client name still guides the entry', () => {
  const { text } = answer('i took in 500 today', services({}));
  assert.match(text, /Add Income/);
});

test('answer: guidance to input routes to the income walkthrough', () => {
  const { text, intent } = answer('can you guide me to input it', services({}));
  assert.equal(intent, 'howto');
  assert.match(text, /Income Tracking/);
  assert.match(text, /Income tab/);
});

test('suggestedQuestions returns different prompts per mode', () => {
  const servicesQuestions = suggestedQuestions('services');
  assert.ok(servicesQuestions.includes('Who owes me money?'));
  const retailQuestions = suggestedQuestions('retail');
  assert.ok(retailQuestions.includes("What's my stock looking like?"));
  assert.ok(!servicesQuestions.includes("What's my stock looking like?"));
});