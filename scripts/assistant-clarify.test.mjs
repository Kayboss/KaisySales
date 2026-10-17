import test from 'node:test';
import assert from 'node:assert/strict';

import {
  missingFields,
  clarifyPrompt,
  mergeFields,
  unknownItemPrompt,
  inventoryStockPrompt,
  parseStockAnswer,
} from '../src/utils/assistant/clarify.js';

const keys = (recordType, payload, mode) => missingFields(recordType, payload, mode).map((f) => f.key);

test('a services expense asks for the columns its own screen has', () => {
  const missing = missingFields(
    'expense',
    { category: '', client_name: '', vendor: '', renewal_date: null },
    'services'
  );
  assert.deepEqual(missing.map((f) => f.key), ['category', 'client_name', 'vendor', 'renewal_date']);
  assert.deepEqual(missing.map((f) => f.label), ['Category', 'Client', 'Vendor', 'Renewal date']);
});

test('a field that is filled is never asked about', () => {
  const missing = missingFields(
    'expense',
    { category: 'Software', client_name: 'Kwame', vendor: 'Adobe', renewal_date: '2026-11-17' },
    'services'
  );
  assert.deepEqual(missing, []);
});

test('the mode decides the vocabulary, not the record type alone', () => {
  assert.deepEqual(keys('expense', {}, 'services'), ['category', 'client_name', 'vendor', 'renewal_date']);
  assert.deepEqual(keys('expense', {}, 'retail'), ['category']);
});

test('a retail expense has no vendor, client or renewal to ask about', () => {
  assert.deepEqual(missingFields('expense', { category: 'Transport', vendor: '', client_name: '' }, 'retail'), []);
});

test('a sale asks for its category', () => {
  assert.deepEqual(keys('sale', { item: 'Rice' }, 'retail'), ['category']);
});

test('income asks for the client and the category', () => {
  assert.deepEqual(keys('service_income', { amount: 500 }, 'services'), ['client_name', 'category']);
});

test('an unknown record type asks for nothing rather than guessing', () => {
  assert.deepEqual(missingFields('refund', {}, 'services'), []);
});

test('the question names the fields instead of saying "anything else"', () => {
  const one = clarifyPrompt(missingFields('expense', { category: 'X', client_name: 'Y', vendor: 'Z' }, 'services'));
  assert.match(one, /renewal date/);
  assert.match(one, /Save/);

  const several = clarifyPrompt(missingFields('expense', {}, 'retail'));
  assert.match(several, /category/);
});

test('nothing missing means no question', () => {
  assert.equal(clarifyPrompt([]), null);
});

test('a blank answer never erases what the first sentence gave', () => {
  const merged = mergeFields(
    { title: 'Adobe', amount: 39, vendor: '', renewal_date: null },
    { vendor: 'Adobe', amount: '', renewal_date: '2026-11-17', client_name: 'Kwame' }
  );
  assert.deepEqual(merged, {
    title: 'Adobe',
    amount: 39,
    vendor: 'Adobe',
    renewal_date: '2026-11-17',
    client_name: 'Kwame',
  });
});

test('an answer adds fields the first sentence never mentioned', () => {
  const merged = mergeFields({ title: 'Adobe', amount: 39 }, { vendor: 'Adobe' });
  assert.equal(merged.vendor, 'Adobe');
  assert.equal(merged.amount, 39);
});

test('an empty answer changes nothing', () => {
  assert.deepEqual(mergeFields({ title: 'Adobe' }, {}), { title: 'Adobe' });
  assert.deepEqual(mergeFields({ title: 'Adobe' }, null), { title: 'Adobe' });
});

test('unknown item prompts the user to add it or pick a stocked item', () => {
  assert.ok(unknownItemPrompt('Bag of cement').includes('Bag of cement'));
  assert.ok(unknownItemPrompt('Bag of cement').includes('Add'));
  assert.ok(unknownItemPrompt('   ').includes('that item'));
});

test('stock prompt names the sold quantity when present', () => {
  assert.ok(inventoryStockPrompt('Cement', 12).includes('12'));
  assert.ok(inventoryStockPrompt('Cement').includes('in stock right now'));
});

test('parseStockAnswer only accepts a plain number count', () => {
  assert.equal(parseStockAnswer('40'), 40);
  assert.equal(parseStockAnswer('40 units'), 40);
  assert.equal(parseStockAnswer('  500  pcs  '), 500);
  assert.equal(parseStockAnswer('40 for the cement'), null);
  assert.equal(parseStockAnswer('about 40'), null);
  assert.equal(parseStockAnswer('forty'), null);
});
