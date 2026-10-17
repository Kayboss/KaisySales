import test from 'node:test';
import assert from 'node:assert/strict';

import { fastParse } from '../src/utils/assistant/fastParse.js';

const TODAY = '2026-10-17';

const parse = (sentence, options = {}) =>
  fastParse(sentence, { mode: 'retail', today: TODAY, ...options });

test('paid 800 for fuel — the everyday retail expense', () => {
  const result = parse('paid 800 for fuel');
  assert.equal(result.kind, 'record');
  assert.equal(result.recordType, 'expense');
  assert.equal(result.confidence, 'high');
  assert.deepEqual(result.fields, { title: 'fuel', amount: '800', date: TODAY });
});

test('category is attached only on an exact match with the own list', () => {
  const result = parse('Paid 300 for transportation', { categories: ['Transportation', 'Fuel'] });
  assert.equal(result.fields.category, 'Transportation');
  const miss = parse('Paid 300 for transportation', { categories: ['Transport'] });
  assert.equal(miss.fields.category, undefined);
});

test('spend … on … today — the date word becomes the date, not the title', () => {
  const result = parse('I spend 80.00 on gas today');
  assert.equal(result.recordType, 'expense');
  assert.deepEqual(result.fields, { title: 'gas', amount: '80', date: TODAY });
});

test('yesterday and last night shift the date back a day', () => {
  assert.equal(parse('spent 20 on data yesterday').fields.date, '2026-10-16');
  assert.equal(parse('spent 20 on data last night').fields.date, '2026-10-16');
});

test('received 5,000 from Kwame — services income with its client', () => {
  const result = parse('Received 5,000 from Kwame', { mode: 'services' });
  assert.equal(result.recordType, 'service_income');
  assert.deepEqual(result.fields, { amount: '5000', client_name: 'Kwame', date: TODAY });
});

test('money in with no item named is refused in retail, never guessed', () => {
  assert.equal(parse('Received 5,000 from Kwame'), null);
  assert.equal(parse('Ama paid me 500'), null);
});

test('Ama paid me 500 — "paid me" reads as money in, in services', () => {
  const result = parse('Ama paid me 500', { mode: 'services' });
  assert.equal(result.recordType, 'service_income');
  assert.deepEqual(result.fields, { amount: '500', client_name: 'Ama', date: TODAY });
});

test('sold 12 bags of cement for 96,000 — a retail sale from stock', () => {
  const result = parse('sold 12 bags of cement for 96,000');
  assert.equal(result.recordType, 'sale');
  assert.deepEqual(result.fields, { item: 'bags of cement', quantity: 12, amount: '96000', date: TODAY });
});

test('sold cement to Ada for 500 — client and price after the item', () => {
  const result = parse('sold cement to Ada for 500');
  assert.deepEqual(result.fields, { item: 'cement', quantity: 1, amount: '500', client_name: 'Ada', date: TODAY });
});

test('sold 2 shirts at 50 each — "at" is a unit price, not a total', () => {
  const result = parse('sold 2 shirts at 50 each');
  assert.deepEqual(result.fields, { item: 'shirts', quantity: 2, unitPrice: 50, date: TODAY });
});

test('a sale in services mode is refused — that mode has no sale type', () => {
  assert.equal(parse('sold cement to Ada for 500', { mode: 'services' }), null);
});

test('no direction word, no guess — the ambiguous sentence goes to the model', () => {
  assert.equal(parse('39.00 for sticker printing'), null);
  assert.equal(parse('300 for transportation'), null);
});

test('no amount means no record — the model or the clarify step asks', () => {
  assert.equal(parse('bought fuel yesterday'), null);
  assert.equal(parse('sold cement'), null);
});

test('a follow-up-shaped second sentence stays with the model', () => {
  assert.equal(parse('Rouje is paying 3000.00 for web design. Its a flat price.', { mode: 'services' }), null);
});

test('the sentence-final full stop does not split the input', () => {
  const result = parse('paid 800 for fuel.');
  assert.equal(result.fields.title, 'fuel');
});

test('thousands separators and decimals are read, then normalised away', () => {
  assert.equal(parse('paid 1,250.50 for rent').fields.amount, '1250.5');
});

test('a leading currency word is skipped', () => {
  assert.equal(parse('paid GHS 800 for fuel').fields.amount, '800');
});

test('empty or amount-free input is null, never a throw', () => {
  assert.equal(parse(''), null);
  assert.equal(parse(null), null);
  assert.equal(parse('how much did i spend this month'), null);
});
