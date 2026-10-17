import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRecordPayload,
  allowedRecordTypes,
  buildInventoryItemPayload,
  matchInventoryItem,
  RECORD_TYPE_SECTIONS,
} from '../src/utils/assistant/recordPayload.js';
import { shouldParseSentence } from '../src/utils/assistant/route.js';
import { applyStockDelta, resolveStockStatus } from '../src/utils/inventory.js';

const TODAY = '2026-10-17';
const MOCK_INVENTORY = [
  { id: 'c1', name: 'Cement', category: 'Building', stock: 50, minStock: 10, costPrice: 'GHS 7200.00', price: 'GHS 8000.00' },
  { id: 'o1', name: 'Oil', category: 'Food', stock: 20, minStock: 5, costPrice: 'GHS 90.00', price: 'GHS 180.00' },
];
const OPTS = { mode: 'retail', currency: 'GHS', today: TODAY, inventory: MOCK_INVENTORY };

test('allowedRecordTypes is mode specific', () => {
  assert.deepEqual(allowedRecordTypes('retail'), ['expense', 'sale']);
  assert.deepEqual(allowedRecordTypes('services'), ['expense', 'service_income']);
  assert.deepEqual(allowedRecordTypes(undefined), ['expense', 'sale']);
});

test('expense mirrors the ExpenseTracking payload', () => {
  const built = buildRecordPayload('expense', { title: 'Fuel', amount: 8000, category: 'Transport' }, OPTS);
  assert.equal(built.ok, true);
  assert.deepEqual(built.payload, {
    title: 'Fuel',
    category: 'Transport',
    quantity: 1,
    unitPrice: 8000,
    date: TODAY,
    amount: 'GHS 8000.00',
    trend: 'up',
  });
});

test('expense keeps a stated unit price and derives the total', () => {
  const built = buildRecordPayload('expense', { title: 'Noodles', quantity: 3, unitPrice: 150 }, OPTS);
  assert.equal(built.ok, true);
  assert.equal(built.payload.quantity, 3);
  assert.equal(built.payload.unitPrice, 150);
  assert.equal(built.payload.amount, 'GHS 450.00');
});

test('expense back-fills unit price from a lump sum', () => {
  const built = buildRecordPayload('expense', { title: 'Stock', quantity: 2, amount: 1000 }, OPTS);
  assert.equal(built.payload.unitPrice, 500);
  assert.equal(built.payload.amount, 'GHS 1000.00');
});

test('a services expense mirrors the ServiceExpenses payload instead', () => {
  const built = buildRecordPayload(
    'expense',
    {
      title: 'Adobe',
      amount: 39,
      category: 'Software',
      vendor: 'Adobe',
      renewal_date: '2026-11-17',
      client_name: 'Kwame',
    },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(built.ok, true);
  assert.deepEqual(built.payload, {
    title: 'Adobe',
    amount: 'GHS 39.00',
    category: 'Software',
    date: TODAY,
    subcategory: 'general',
    vendor: 'Adobe',
    renewal_date: '2026-11-17',
    is_asset: false,
    asset_lifetime_years: null,
    transaction_fee: 0,
    client_name: 'Kwame',
  });
});

test('a services expense carries none of the retail-only keys', () => {
  const built = buildRecordPayload('expense', { title: 'Adobe', amount: 39 }, { ...OPTS, mode: 'services' });
  assert.equal('quantity' in built.payload, false);
  assert.equal('unitPrice' in built.payload, false);
  assert.equal('trend' in built.payload, false);
});

test('a retail expense stays exactly as it was', () => {
  const built = buildRecordPayload('expense', { title: 'Fuel', amount: 10 }, OPTS);
  assert.equal('client_name' in built.payload, false);
  assert.equal('renewal_date' in built.payload, false);
  assert.equal('subcategory' in built.payload, false);
});

test('a services expense adds the transaction fee to the stored amount', () => {
  const built = buildRecordPayload(
    'expense',
    { title: 'Adobe', amount: 39, transaction_fee: 2 },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(built.payload.transaction_fee, 2);
  assert.equal(built.payload.amount, 'GHS 41.00');
});

test('a services expense keeps an asset year count only for a stated asset', () => {
  const asset = buildRecordPayload(
    'expense',
    { title: 'Laptop', amount: 5000, is_asset: true, asset_lifetime_years: 3 },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(asset.payload.is_asset, true);
  assert.equal(asset.payload.asset_lifetime_years, 3);

  const noLifetime = buildRecordPayload(
    'expense',
    { title: 'Laptop', amount: 5000, is_asset: true },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(noLifetime.payload.asset_lifetime_years, null);

  const notAnAsset = buildRecordPayload(
    'expense',
    { title: 'Fuel', amount: 50, asset_lifetime_years: 3 },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(notAnAsset.payload.is_asset, false);
  assert.equal(notAnAsset.payload.asset_lifetime_years, null);
});

test('a services expense refuses a subcategory the screen does not offer', () => {
  const junk = buildRecordPayload(
    'expense',
    { title: 'Adobe', amount: 39, subcategory: 'nonsense' },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(junk.payload.subcategory, 'general');

  const saas = buildRecordPayload(
    'expense',
    { title: 'Adobe', amount: 39, subcategory: 'saas' },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(saas.payload.subcategory, 'saas');
});

test('a services expense without an amount is still refused', () => {
  const built = buildRecordPayload('expense', { title: 'Adobe' }, { ...OPTS, mode: 'services' });
  assert.equal(built.ok, false);
  assert.match(built.error, /how much/i);
});

test('the services expense summary shows the columns the user checks', () => {
  const built = buildRecordPayload(
    'expense',
    {
      title: 'Adobe',
      amount: 39,
      category: 'Software',
      vendor: 'Adobe',
      client_name: 'Kwame',
      renewal_date: '2026-11-17',
    },
    { ...OPTS, mode: 'services' }
  );
  const labels = built.summary.map((r) => r.label);
  assert.deepEqual(labels.slice(0, 7), ['Amount', 'What', 'Client', 'Category', 'Vendor', 'Date', 'Renewal']);

  // A blank column is simply not shown; the card marks it "Not set" instead.
  const bare = buildRecordPayload('expense', { title: 'Adobe', amount: 39 }, { ...OPTS, mode: 'services' });
  assert.equal(bare.summary.some((r) => r.label === 'Renewal'), false);
});

test('expense without an amount is refused with a question', () => {
  const built = buildRecordPayload('expense', { title: 'Fuel' }, OPTS);
  assert.equal(built.ok, false);
  assert.match(built.error, /how much/i);
});

test('expense without a title is refused', () => {
  const built = buildRecordPayload('expense', { amount: 500 }, OPTS);
  assert.equal(built.ok, false);
  assert.match(built.error, /spent on/i);
});

test('expense rejects a mode mismatch instead of writing it', () => {
  const built = buildRecordPayload('sale', { item: 'Rice', amount: 90 }, { ...OPTS, mode: 'services' });
  assert.equal(built.ok, false);
  assert.match(built.error, /business type/i);
});

test('sale mirrors the DailySales payload and relies on full numbers', () => {
  const built = buildRecordPayload(
    'sale',
    { item: 'Cement', quantity: 12, unitPrice: 8000, paymentMethod: 'cash' },
    OPTS
  );
  assert.equal(built.ok, true);
  assert.equal(built.payload.item, 'Cement');
  assert.equal(built.payload.quantity, 12);
  assert.equal(built.payload.unitPrice, 8000);
  assert.equal(built.payload.amount, 'GHS 96000.00');
  assert.equal(built.payload.paymentMethod, 'Cash');
  assert.equal(built.payload.date, TODAY);
  assert.ok(built.payload.time);
  assert.equal(built.inventoryMatch?.stock, 50);
  assert.equal(built.inventoryMatch?.cost, 7200);
});

test('sale derives unit price from a total when only a total was said', () => {
  const built = buildRecordPayload('sale', { item: 'Oil', quantity: 2, amount: 180 }, OPTS);
  assert.equal(built.payload.unitPrice, 90);
  assert.equal(built.payload.amount, 'GHS 180.00');
});

test('sale normalises mobile money and card payment wordings', () => {
  assert.equal(buildRecordPayload('sale', { item: 'A', amount: 5, paymentMethod: 'momo' }, OPTS).payload.paymentMethod, 'Mobile Money');
  assert.equal(buildRecordPayload('sale', { item: 'A', amount: 5, paymentMethod: 'Visa' }, OPTS).payload.paymentMethod, 'Card');
  assert.equal(buildRecordPayload('sale', { item: 'A', amount: 5 }, OPTS).payload.paymentMethod, 'Cash');
});

test('sale without an item or price is refused', () => {
  assert.match(buildRecordPayload('sale', { amount: 50 }, OPTS).error, /sell\?/i);
  assert.match(buildRecordPayload('sale', { item: 'Rice' }, OPTS).error, /how much/i);
});

test('a sale names its inventory row, or returns no match to block on', () => {
  const matched = buildRecordPayload('sale', { item: 'cement', amount: 800 }, OPTS);
  assert.equal(matched.inventoryMatch.name, 'Cement');
  assert.equal(matched.inventoryMatch.id, 'c1');

  const unmatched = buildRecordPayload('sale', { item: 'Rice', amount: 800 }, OPTS);
  assert.equal(unmatched.ok, true);
  assert.equal(unmatched.inventoryMatch, null);
});

test('a sale falls back to the category of the item it sold', () => {
  const fromRow = buildRecordPayload('sale', { item: 'Oil', amount: 100 }, OPTS);
  assert.equal(fromRow.payload.category, 'Food');
  assert.equal(fromRow.payload.cost, 90);

  const spoken = buildRecordPayload('sale', { item: 'Oil', amount: 100, category: 'Wholesale' }, OPTS);
  assert.equal(spoken.payload.category, 'Wholesale');
});

test('a sale with no inventory list is not blocked by a missing list', () => {
  const built = buildRecordPayload('sale', { item: 'Rice', amount: 100 }, { ...OPTS, inventory: undefined });
  assert.equal(built.ok, true);
  assert.equal(built.inventoryMatch, null);
});

test('an inventory item is built the way the Inventory screen writes one', () => {
  assert.deepEqual(buildInventoryItemPayload({ name: 'Cement', category: 'Building', stock: '12', costPrice: 'GHS 7200.00' }), {
    name: 'Cement',
    category: 'Building',
    stock: 12,
    minStock: 5,
    price: 'GHS 0.00',
    costPrice: 'GHS 7200.00',
    status: 'In Stock',
  });
  // A blank minimum is the default, but an explicit zero is left alone.
  assert.equal(buildInventoryItemPayload({ name: 'Rope', stock: 0, minStock: 0 }).minStock, 0);
  assert.equal(buildInventoryItemPayload({ name: 'Rope', stock: 2 }).status, 'Low Stock');
});

test('inventory matching is exact and case-insensitive, never a substring', () => {
  const items = [{ id: 'a', name: 'Cement' }, { id: 'b', name: 'cement bags' }];
  assert.equal(matchInventoryItem(items, 'cement')?.id, 'a');
  assert.equal(matchInventoryItem(items, 'CEMENT BAGS')?.id, 'b');
  assert.equal(matchInventoryItem(items, 'bag'), null);
  assert.equal(matchInventoryItem([], 'cement'), null);
  assert.equal(matchInventoryItem(undefined, 'cement'), null);
});

// Regression: applyStockDelta's delta is units LEAVING the shelf, so a positive
// number deducts. saveParsedRecord once passed a negative quantity here, which
// meant every assistant sale added stock instead of removing it.
test('a sale moves its units off the shelf in the same direction as DailySales', () => {
  const built = buildRecordPayload('sale', { item: 'Cement', quantity: 12, amount: 100 }, OPTS);
  const applied = applyStockDelta(built.inventoryMatch.stock, built.payload.quantity, built.inventoryMatch.minStock);
  assert.equal(applied.stock, 38);
  assert.equal(applied.shortfall, 0);
  assert.equal(
    resolveStockStatus(applied.stock, built.inventoryMatch.minStock),
    'In Stock'
  );

  const oversold = applyStockDelta(38, 50, 10);
  assert.equal(oversold.stock, 0);
  assert.equal(oversold.shortfall, 12);
});

test('service_income mirrors the IncomeTracking payload', () => {
  const built = buildRecordPayload(
    'service_income',
    { client_name: 'Kwame', amount: 500, category: 'Design', notes: 'Logo job' },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(built.ok, true);
  assert.deepEqual(built.payload, {
    client_name: 'Kwame',
    amount: 500,
    platform_fee: 0,
    net_amount: 500,
    platform_tag: 'direct',
    milestone_label: '',
    payment_date: TODAY,
    notes: 'Logo job',
    category: 'Design',
  });
});

test('service_income nets a platform fee out of the amount', () => {
  const built = buildRecordPayload(
    'service_income',
    { client_name: 'Ada', amount: 1000, platform_fee: 50 },
    { ...OPTS, mode: 'services' }
  );
  assert.equal(built.payload.platform_fee, 50);
  assert.equal(built.payload.net_amount, 950);
});

test('service_income without an amount is refused', () => {
  const built = buildRecordPayload('service_income', { client_name: 'Ada' }, { ...OPTS, mode: 'services' });
  assert.equal(built.ok, false);
  assert.match(built.error, /how much/i);
});

test('a stated date overrides today and an unusable one falls back', () => {
  const stated = buildRecordPayload('expense', { title: 'Rent', amount: 900, date: '2026-09-01' }, OPTS);
  assert.equal(stated.payload.date, '2026-09-01');
  const junk = buildRecordPayload('expense', { title: 'Rent', amount: 900, date: 'last tuesday' }, OPTS);
  assert.equal(junk.payload.date, TODAY);
});

test('no payload ever carries user_id or an id', () => {
  for (const type of ['expense', 'sale', 'service_income']) {
    const fields =
      type === 'expense'
        ? { title: 'Fuel', amount: 10 }
        : type === 'sale'
          ? { item: 'Cement', amount: 10 }
          : { client_name: 'A', amount: 10 };
    const built = buildRecordPayload(type, fields, { ...OPTS, mode: type === 'sale' ? 'retail' : 'services' });
    assert.equal(built.ok, true);
    assert.equal('user_id' in built.payload, false);
    assert.equal('id' in built.payload, false);
  }
});

test('summary rows are the amount plus the facts a person checks', () => {
  const expense = buildRecordPayload('expense', { title: 'Fuel', amount: 8000 }, OPTS);
  assert.equal(expense.summary[0].label, 'Amount');
  assert.match(expense.summary[0].value.replace(/\u00A0/g, ' '), /^GHS 8,000\.00$/);

  const sale = buildRecordPayload('sale', { item: 'Cement', quantity: 2, amount: 100 }, OPTS);
  assert.ok(sale.summary.some((row) => row.label === 'Payment'));

  const income = buildRecordPayload('service_income', { client_name: 'Ada', amount: 100 }, { ...OPTS, mode: 'services' });
  assert.ok(income.summary.some((row) => row.label === 'Client' && row.value === 'Ada'));
});

test('every record type has a section name for the saved note', () => {
  assert.equal(RECORD_TYPE_SECTIONS.expense, 'Expenses');
  assert.equal(RECORD_TYPE_SECTIONS.sale, 'Sales History');
  assert.equal(RECORD_TYPE_SECTIONS.service_income, 'Income Tracking');
});

test('routing sends money events to the parser and plain questions locally', () => {
  assert.equal(shouldParseSentence('paid 800 for fuel'), true);
  assert.equal(shouldParseSentence('sold 12 bags of cement for 96,000'), true);
  assert.equal(shouldParseSentence('received 500 from Kwame'), true);
  assert.equal(shouldParseSentence('sold cement to Ada'), true);
  assert.equal(shouldParseSentence('bought fuel yesterday'), true);

  assert.equal(shouldParseSentence('how much did I make this month?'), false);
  assert.equal(shouldParseSentence('who owes me money?'), false);
  assert.equal(shouldParseSentence('what are my top selling items'), false);
  assert.equal(shouldParseSentence('show me my expenses this year'), false);
  assert.equal(shouldParseSentence(''), false);
  assert.equal(shouldParseSentence('   '), false);
});

test('routing answers an intent to record on the spot instead of calling the parser', () => {
  assert.equal(shouldParseSentence('I want to record an expenses'), false);
  assert.equal(shouldParseSentence('let me record an expense'), false);
  assert.equal(shouldParseSentence('add an expense'), false);
  assert.equal(shouldParseSentence('help me record an expense'), false);
  assert.equal(shouldParseSentence('i want to track my expenses'), false);

  // a number is still a real record, however it is phrased
  assert.equal(shouldParseSentence('record an expense of 50 for fuel'), true);
  assert.equal(shouldParseSentence('i want to record 2 sales'), true);
});
