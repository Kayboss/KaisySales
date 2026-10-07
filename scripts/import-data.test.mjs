import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDelimited, detectDelimiter } from '../src/utils/import/csv.js';
import {
  normalizeHeader,
  matchColumn,
  matchHeaders,
  buildAutoMapping,
} from '../src/utils/import/headers.js';
import {
  parseMoney,
  parseInteger,
  parseBoolean,
  parseEnum,
  parseDate,
  suggestDayFirst,
  formatMoneyText,
} from '../src/utils/import/coerce.js';
import { buildRecord, validateRows } from '../src/utils/import/validate.js';
import { isFeatureEnabled, IMPORT_ENABLED, ASSISTANT_ENABLED } from '../src/utils/features.js';
import { buildTemplate } from '../src/utils/import/template.js';
import { findDuplicates, applyImportValues, NEAR_THRESHOLD } from '../src/utils/import/duplicates.js';
import {
  getEntity,
  getEntitiesForMode,
  getRequiredFields,
  CATEGORY_TYPE_BY_ENTITY,
} from '../src/utils/import/schema.js';

const entity = (key) => {
  const found = getEntity(key);
  assert.ok(found, `entity ${key} should exist`);
  return found;
};

const allEntities = () => [
  entity('inventory'),
  entity('sales'),
  entity('expenses'),
  entity('service_income'),
  entity('recurring_income'),
  entity('customers'),
];

test('parseDelimited reads quoted values containing the delimiter', () => {
  const { headers, rows } = parseDelimited('Name,Price\n"Rice, local","GHS 1,200.00"');
  assert.deepEqual(headers, ['Name', 'Price']);
  assert.deepEqual(rows, [['Rice, local', 'GHS 1,200.00']]);
});

test('parseDelimited unescapes doubled quotes', () => {
  const { rows } = parseDelimited('a\n"he said ""hi"""');
  assert.deepEqual(rows, [['he said "hi"']]);
});

test('parseDelimited keeps newlines inside quoted values', () => {
  const { rows } = parseDelimited('a,b\n"line1\nline2",3');
  assert.deepEqual(rows, [['line1\nline2', '3']]);
});

test('parseDelimited handles CRLF endings', () => {
  const { rows } = parseDelimited('a,b\r\n1,2\r\n3,4\r\n');
  assert.deepEqual(rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('parseDelimited strips a leading byte order mark', () => {
  const { headers, rows } = parseDelimited('\uFEFFItem,Qty\nRice,3');
  assert.deepEqual(headers, ['Item', 'Qty']);
  assert.deepEqual(rows, [['Rice', '3']]);
});

test('parseDelimited trims unquoted cells but preserves quoted ones', () => {
  const { rows } = parseDelimited('a,b,c\n  x  ,"  y  ",z');
  assert.deepEqual(rows, [['x', '  y  ', 'z']]);
});

test('parseDelimited detects tab and semicolon files', () => {
  assert.equal(detectDelimiter('Item\tQty\nRice\t3'), '\t');
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('only one column\nvalue'), ',');
});

test('parseDelimited pads short rows and warns', () => {
  const { rows, warnings } = parseDelimited('a,b,c\n1,2\n1,2,3');
  assert.deepEqual(rows, [
    ['1', '2', ''],
    ['1', '2', '3'],
  ]);
  assert.ok(warnings.some((warning) => warning.includes('2 columns')));
});

test('parseDelimited reports an unterminated quote', () => {
  const { warnings } = parseDelimited('a,b\n"oops,2');
  assert.ok(warnings.some((warning) => warning.includes('never closed')));
});

test('parseDelimited distinguishes empty input from header-only input', () => {
  const empty = parseDelimited('   ');
  assert.deepEqual(empty.headers, []);
  assert.ok(empty.warnings.some((warning) => warning.includes('empty')));

  const headerOnly = parseDelimited('a,b');
  assert.deepEqual(headerOnly.headers, ['a', 'b']);
  assert.ok(headerOnly.warnings.some((warning) => warning.includes('no data rows')));
});

test('parseDelimited preserves a trailing empty column', () => {
  const { headers, rows } = parseDelimited('a,b,\n1,2,');
  assert.deepEqual(headers, ['a', 'b', '']);
  assert.deepEqual(rows, [['1', '2', '']]);
});

test('no entity declares the same normalised name twice', () => {
  for (const current of allEntities()) {
    const seen = new Map();
    for (const field of current.fields) {
      const names = [field.key, ...field.aliases].map(normalizeHeader);
      for (const name of names) {
        if (name === '') continue;
        const previous = seen.get(name);
        if (previous && previous !== field.key) {
          assert.fail(
            `${current.key}: "${name}" is claimed by both ${previous} and ${field.key}`
          );
        }
        seen.set(name, field.key);
      }
    }
  }
});

test('every alias and key matches its own field exactly', () => {
  for (const current of allEntities()) {
    const index = undefined;
    for (const field of current.fields) {
      const names = [field.key, ...field.aliases];
      for (const name of names) {
        const match = matchColumn(name, current, index);
        assert.equal(match.field, field.key, `${current.key}: "${name}" should map to ${field.key}`);
        assert.equal(match.confidence, 'exact', `${current.key}: "${name}" should be exact`);
      }
    }
  }
});

test('headers that only differ by punctuation still match', () => {
  const inventory = entity('inventory');
  assert.equal(matchColumn('client_name', inventory).confidence, 'none');
  assert.equal(matchColumn('Unit Price', inventory).field, 'price');
  assert.equal(matchColumn('unit_price', inventory).field, 'price');
  assert.equal(matchColumn('Min Stock', inventory).field, 'minStock');
});

test('a close miss is reported as needing review rather than guessed silently', () => {
  const inventory = entity('inventory');
  const match = matchColumn('prodct', inventory);
  assert.equal(match.field, 'name');
  assert.equal(match.confidence, 'fuzzy');
});

test('identifiers a spreadsheet exports about itself are ignored', () => {
  const inventory = entity('inventory');
  for (const header of ['id', 'user_id', 'created_at', 'Row Number', 'SL No']) {
    assert.equal(matchColumn(header, inventory).field, null, header);
    assert.equal(matchColumn(header, inventory).confidence, 'ignored', header);
  }
});

test('the second column claiming a field is marked as a duplicate', () => {
  const inventory = entity('inventory');
  const { columns, needsReview } = matchHeaders(['Price', 'Price', 'Name'], inventory);
  assert.equal(columns[0].field, 'price');
  assert.equal(columns[1].field, null);
  assert.equal(columns[1].confidence, 'duplicate');
  assert.equal(needsReview, true);
});

test('unmatched columns are reported so the mapping screen is never silent', () => {
  const inventory = entity('inventory');
  const { unmapped } = matchHeaders(['Name'], inventory);
  assert.ok(unmapped.includes('stock'));
  assert.ok(unmapped.includes('price'));
  assert.ok(!unmapped.includes('name'));
});

test('money text accepts every format the app itself writes', () => {
  assert.deepEqual(parseMoney('GHS 1,200.00'), { status: 'ok', value: 1200 });
  assert.deepEqual(parseMoney('GH₵500'), { status: 'ok', value: 500 });
  assert.deepEqual(parseMoney('₵200.50'), { status: 'ok', value: 200.5 });
  assert.deepEqual(parseMoney('GHS 500'), { status: 'ok', value: 500 });
  assert.equal(parseMoney('-40').value, -40);
  assert.equal(parseMoney('.50').value, 0.5);
});

test('an empty cell is blank, and a broken cell is invalid — never the same', () => {
  assert.equal(parseMoney('').status, 'blank');
  assert.equal(parseMoney('   ').status, 'blank');
  assert.equal(parseMoney(null).status, 'blank');
  assert.equal(parseMoney(undefined).status, 'blank');

  assert.equal(parseMoney('abc').status, 'invalid');
  assert.equal(parseMoney('12abc').status, 'invalid');
  assert.equal(parseMoney('1,50').status, 'invalid');
  assert.equal(parseMoney('price varies').status, 'invalid');
});

test('integers reject fractional stock', () => {
  assert.equal(parseInteger('5').value, 5);
  assert.equal(parseInteger('0').value, 0);
  assert.equal(parseInteger('5.0').value, 5);
  assert.equal(parseInteger('1.5').status, 'invalid');
  assert.equal(parseInteger('').status, 'blank');
  assert.equal(parseInteger('pcs').status, 'invalid');
});

test('booleans read the words a spreadsheet actually contains', () => {
  for (const value of ['yes', 'Yes', 'YES', 'true', '1', 'on', 'active', 'enabled']) {
    assert.equal(parseBoolean(value).value, true, value);
  }
  for (const value of ['no', 'No', 'false', '0', 'off', 'inactive']) {
    assert.equal(parseBoolean(value).value, false, value);
  }
  assert.equal(parseBoolean('').status, 'blank');
  assert.equal(parseBoolean('maybe').status, 'invalid');
});

test('recurring frequency maps synonyms and refuses anything else', () => {
  const frequency = getEntity('recurring_income').fields.find(
    (field) => field.key === 'frequency'
  );

  assert.equal(parseEnum('monthly', frequency).value, 'monthly');
  assert.equal(parseEnum('Monthly', frequency).value, 'monthly');
  assert.equal(parseEnum('1 month', frequency).value, 'monthly');
  assert.equal(parseEnum('EVERY MONTH', frequency).value, 'monthly');
  assert.equal(parseEnum('quarterly', frequency).value, 'quarterly');
  assert.equal(parseEnum('3 months', frequency).value, 'quarterly');
  assert.equal(parseEnum('annually', frequency).value, 'yearly');
  assert.equal(parseEnum('per annum', frequency).value, 'yearly');

  assert.equal(parseEnum('weekly', frequency).status, 'invalid');
  assert.equal(parseEnum('', frequency).status, 'blank');
});

test('year-first dates are unambiguous', () => {
  assert.equal(parseDate('2026-03-15').value, '2026-03-15');
  assert.equal(parseDate('2026-3-5').value, '2026-03-05');
  assert.equal(parseDate('2026/03/15').value, '2026-03-15');
});

test('a day above twelve resolves itself whichever way it is written', () => {
  assert.equal(parseDate('15/03/2026').value, '2026-03-15');
  assert.equal(parseDate('03/25/2026').value, '2026-03-25');
  assert.equal(parseDate('25-03-2026').value, '2026-03-25');
});

test('an ambiguous date is refused until the user picks a convention', () => {
  const result = parseDate('05/03/2026');
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.candidates.length, 2);

  assert.equal(parseDate('05/03/2026', { dayFirst: true }).value, '2026-03-05');
  assert.equal(parseDate('05/03/2026', { dayFirst: false }).value, '2026-05-03');
});

test('month names remove the ambiguity entirely', () => {
  assert.equal(parseDate('15 Jan 2026').value, '2026-01-15');
  assert.equal(parseDate('15-Jan-2026').value, '2026-01-15');
  assert.equal(parseDate('Jan 15, 2026').value, '2026-01-15');
  assert.equal(parseDate('15 September 2026').value, '2026-09-15');
});

test('dates that do not exist are rejected', () => {
  assert.equal(parseDate('32/01/2026').status, 'invalid');
  assert.equal(parseDate('29/02/2026').status, 'invalid');
  assert.equal(parseDate('29/02/2024').value, '2024-02-29');
  assert.equal(parseDate('31/04/2026').status, 'invalid');
});

test('a date column with no year at all is not guessed', () => {
  assert.equal(parseDate('yesterday').status, 'invalid');
  assert.equal(parseDate('10:30').status, 'invalid');
  assert.equal(parseDate('next week').status, 'invalid');
  assert.equal(parseDate('').status, 'blank');
});

test('the day-first convention can be read off unambiguous rows', () => {
  assert.equal(suggestDayFirst(['25/03/2026', '30/01/2026']), true);
  assert.equal(suggestDayFirst(['03/25/2026']), false);
  assert.equal(suggestDayFirst(['05/03/2026']), null);
  assert.equal(suggestDayFirst(['not a date']), null);
});

test('money text is written back in the exact shape the app expects', () => {
  assert.equal(formatMoneyText(1200), 'GHS 1200.00');
  assert.equal(formatMoneyText(0.5), 'GHS 0.50');
  assert.equal(formatMoneyText(45), 'GHS 45.00');
});

test('a missing required value blocks the row', () => {
  const inventory = entity('inventory');
  const mapping = { 0: 'name', 1: 'stock' };
  const result = buildRecord(inventory, ['', '5'], mapping);

  assert.equal(result.hasErrors, true);
  assert.ok(result.issues.some((issue) => issue.field === 'name'));
  assert.ok(result.record.stock === 5);
});

test('a blank optional cell adds no issue, a broken one does', () => {
  const inventory = entity('inventory');

  const blankRow = buildRecord(inventory, ['Rice', ''], { 0: 'name', 1: 'price' });
  assert.equal(blankRow.hasErrors, false);
  assert.equal(Object.prototype.hasOwnProperty.call(blankRow.record, 'price'), false);

  const brokenRow = buildRecord(inventory, ['Rice', 'n/a'], { 0: 'name', 1: 'price' });
  assert.equal(brokenRow.hasErrors, true);
  assert.ok(brokenRow.issues.some((issue) => issue.field === 'price'));
});

test('a row with no content at all is reported empty, not blocked', () => {
  const inventory = entity('inventory');
  const result = buildRecord(inventory, ['', '', ''], { 0: 'name', 1: 'price' });
  assert.equal(result.isEmpty, true);
  assert.equal(result.hasErrors, false);
});

test('sales total is worked out from quantity and unit price', () => {
  const sales = entity('sales');
  const mapping = { 0: 'item', 1: 'quantity', 2: 'unitPrice' };
  const result = buildRecord(sales, ['Rice', '3', '10'], mapping);

  assert.equal(result.hasErrors, false);
  assert.equal(result.record.amount, 'GHS 30.00');
  assert.equal(result.record.unitPrice, 10);
  assert.equal(result.record.quantity, 3);
});

test('an explicit sales total wins over the worked-out one', () => {
  const sales = entity('sales');
  const mapping = { 0: 'item', 1: 'quantity', 2: 'unitPrice', 3: 'amount' };
  const result = buildRecord(sales, ['Rice', '3', '10', 'GHS 50.00'], mapping);
  assert.equal(result.record.amount, 'GHS 50.00');
});

test('net income is amount minus platform fee when not supplied', () => {
  const income = entity('service_income');
  const mapping = { 0: 'amount', 1: 'platformFee' };

  const withFee = buildRecord(income, ['500', '50'], mapping);
  assert.equal(withFee.record.netAmount, 450);

  const withoutFee = buildRecord(income, ['500', ''], mapping);
  assert.equal(withoutFee.record.netAmount, 500);
  assert.equal(withoutFee.record.platformFee, undefined);
});

test('a supplied net amount is never overwritten', () => {
  const income = entity('service_income');
  const mapping = { 0: 'amount', 1: 'platformFee', 2: 'netAmount' };
  const result = buildRecord(income, ['500', '50', '100'], mapping);
  assert.equal(result.record.netAmount, 100);
});

test('a fee larger than the amount is warned about rather than hidden', () => {
  const income = entity('service_income');
  const mapping = { 0: 'amount', 1: 'platformFee' };
  const result = buildRecord(income, ['100', '150'], mapping);

  assert.equal(result.record.netAmount, -50);
  assert.ok(result.issues.some((issue) => issue.severity === 'warning'));
});

test('an expense with no amount is a warning, not a failure', () => {
  const expenses = entity('expenses');
  const mapping = { 0: 'title', 1: 'amount' };
  const result = buildRecord(expenses, ['Fuel', ''], mapping);

  assert.equal(result.hasErrors, false);
  assert.ok(result.issues.some((issue) => issue.severity === 'warning'));
  assert.equal(result.record.title, 'Fuel');
});

test('an unreadable amount blocks the row instead of becoming zero', () => {
  const expenses = entity('expenses');
  const mapping = { 0: 'title', 1: 'amount' };
  const result = buildRecord(expenses, ['Fuel', 'call me'], mapping);

  assert.equal(result.hasErrors, true);
  assert.equal(result.record.amount, undefined);
});

test('every required field on every entity is actually in its field list', () => {
  for (const current of allEntities()) {
    for (const field of getRequiredFields(current)) {
      assert.ok(
        current.fields.some((candidate) => candidate.key === field.key),
        `${current.key}.${field.key}`
      );
    }
  }
});

test('retail and services never see each other\u2019s entities', () => {
  const retail = getEntitiesForMode('retail').map((item) => item.key).sort();
  const services = getEntitiesForMode('services').map((item) => item.key).sort();

  assert.deepEqual(retail, ['expenses', 'inventory', 'sales']);
  assert.deepEqual(services, ['customers', 'expenses', 'recurring_income', 'service_income']);
  assert.ok(retail.includes('expenses') && services.includes('expenses'));
  assert.ok(!retail.includes('service_income'));
  assert.ok(!services.includes('inventory'));
});

test('validateRows counts ready, blocked and empty rows separately', () => {
  const inventory = entity('inventory');
  const headers = ['Item', 'Price', 'Stock'];
  const mapping = buildAutoMapping(headers, inventory);
  const { summary } = validateRows(
    inventory,
    [
      ['Rice', 'GHS 10.00', '5'],
      ['', 'GHS 10.00', '5'],
      ['Sugar', 'n/a', '0'],
      ['', '', ''],
    ],
    mapping
  );

  assert.equal(summary.total, 4);
  assert.equal(summary.ready, 1);
  assert.equal(summary.blocked, 2);
  assert.equal(summary.empty, 1);
});

test('a full file runs from csv text to records without a gap', () => {
  const csv = 'Client,Amount,Frequency,Next Due\nAcme Ltd,"GHS 1,500.00",monthly,2026-11-01\nBob,"200",annually,05/03/2026';
  const parsed = parseDelimited(csv);
  const recurring = entity('recurring_income');
  const mapping = buildAutoMapping(parsed.headers, recurring);

  assert.equal(mapping[0], 'clientName');
  assert.equal(mapping[1], 'amount');
  assert.equal(mapping[2], 'frequency');
  assert.equal(mapping[3], 'nextDueDate');

  const { results, summary } = validateRows(recurring, parsed.rows, mapping, { dayFirst: true });

  assert.equal(summary.ready, 2);
  assert.equal(results[0].record.amount, 1500);
  assert.equal(results[0].record.frequency, 'monthly');
  assert.equal(results[1].record.frequency, 'yearly');
  assert.equal(results[1].record.nextDueDate, '2026-03-05');
});

test('import and assistant flags resolve to real booleans', () => {
  assert.equal(typeof IMPORT_ENABLED, 'boolean');
  assert.equal(typeof ASSISTANT_ENABLED, 'boolean');
});

test('a feature ships on unless it is switched off explicitly', () => {
  for (const value of ['false', 'FALSE', '  false  ', '0', 'no', 'off']) {
    assert.equal(isFeatureEnabled(value), false, value);
  }

  for (const value of [undefined, null, '', 'true', '1', 'yes', 'anything-else']) {
    assert.equal(isFeatureEnabled(value), true, String(value));
  }
});
test('every entity knows which category type it feeds', () => {
  assert.equal(CATEGORY_TYPE_BY_ENTITY.inventory, 'inventory');
  assert.equal(CATEGORY_TYPE_BY_ENTITY.sales, 'sales');
  assert.equal(CATEGORY_TYPE_BY_ENTITY.expenses, 'expense');
  assert.equal(CATEGORY_TYPE_BY_ENTITY.service_income, 'income');
  assert.equal(CATEGORY_TYPE_BY_ENTITY.recurring_income, 'income');
  assert.equal(CATEGORY_TYPE_BY_ENTITY.customers, null);
});

test('each entity template is a real CSV file with a filename', () => {
  for (const current of allEntities()) {
    const template = buildTemplate(current.key);
    assert.ok(template, current.key);
    assert.ok(template.filename.startsWith('kaisysales-'), current.key);
    assert.ok(template.filename.endsWith('.csv'), current.key);
    assert.match(template.csv, /^[\s\S]*,[\s\S]*\n[\s\S]*,[\s\S]*\n?/, current.key);
  }
});

test('every template repopulates its entity with a single ready row', () => {
  for (const current of allEntities()) {
    const template = buildTemplate(current.key);
    const parsed = parseDelimited(template.csv);
    const mapping = buildAutoMapping(parsed.headers, current);
    const mapped = Object.keys(mapping).length;

    assert.ok(
      mapped >= current.fields.filter((field) => field.writable).length - 2,
      `${current.key}: only ${mapped} columns auto-matched`
    );

    const result = validateRows(current, parsed.rows, mapping, { dayFirst: true });
    assert.equal(result.summary.ready, 1, current.key);
    assert.equal(result.summary.blocked, 0, current.key);
    assert.equal(result.summary.empty, 0, current.key);
  }
});

test('a template meant for one mode never reads clean into the other', () => {
  const retailTemplate = parseDelimited(buildTemplate('inventory').csv);
  const customers = entity('customers');
  const asCustomers = validateRows(
    customers,
    retailTemplate.rows,
    buildAutoMapping(retailTemplate.headers, customers),
    { dayFirst: true }
  );
  assert.equal(asCustomers.summary.ready, 0, 'an inventory file must not import as customers');
});

test('exact duplicates are caught regardless of spacing, case or currency prefix', () => {
  const inventory = entity('inventory');
  const incoming = [{ name: 'Wheat flour', price: 'GHS 12.00' }];
  const existing = [{ id: '1', name: 'wheat  flour ', price: 'GH\u20b512.00' }];
  const { exact, near, unique } = findDuplicates(inventory, incoming, existing);

  assert.equal(exact.length, 1);
  assert.equal(near.length, 0);
  assert.equal(unique, 0);
  assert.equal(exact[0].existing.id, '1');
});

test('sales compare item, total and date with legacy and new prefixes equal', () => {
  const sales = entity('sales');
  const { exact } = findDuplicates(
    sales,
    [{ item: 'Rice', amount: 'GHS 1000.00', date: '2026-11-01' }],
    [{ id: '2', item: 'rice', amount: 'GH\u20b51,000.00', date: '2026-11-01' }]
  );
  assert.equal(exact.length, 1);
});

test('a different sales total is not an exact match and stays unique', () => {
  const sales = entity('sales');
  const { exact, near, unique } = findDuplicates(
    sales,
    [{ item: 'Rice', amount: 'GHS 1000.00', date: '2026-11-01' }],
    [{ id: '2', item: 'Rice', amount: 'GHS 1200.00', date: '2026-11-01' }]
  );
  assert.equal(exact.length, 0);
  assert.equal(near.length, 0);
  assert.equal(unique, 1);
});

test('a one-character typo on a name is a near duplicate', () => {
  const inventory = entity('inventory');
  const { exact, near, unique } = findDuplicates(
    inventory,
    [{ name: 'Maize meal' }],
    [{ id: '3', name: 'Maize mel' }]
  );
  assert.equal(exact.length, 0);
  assert.equal(near.length, 1);
  assert.equal(unique, 0);
  assert.ok(near[0].score >= NEAR_THRESHOLD);
});

test('sugar and sugar cubes are different rows, not near matches', () => {
  const inventory = entity('inventory');
  const { exact, near, unique } = findDuplicates(
    inventory,
    [{ name: 'sugar' }],
    [{ id: '4', name: 'sugar cubes' }]
  );
  assert.equal(exact.length, 0);
  assert.equal(near.length, 0);
  assert.equal(unique, 1);
});

test('a customer file that adds an email matches the name-only record already there', () => {
  const customers = entity('customers');
  const { exact } = findDuplicates(
    customers,
    [{ name: 'Acme Ltd', email: 'billing@acme.example' }],
    [{ id: '6', name: 'acme ltd' }]
  );
  assert.equal(exact.length, 1);
});

test('unrelated customers never match each other', () => {
  const customers = entity('customers');
  const { exact, near, unique } = findDuplicates(
    customers,
    [{ name: 'Ama', email: 'a@example.com' }],
    [{ name: 'Kofi', email: 'k@example.com' }]
  );
  assert.equal(exact.length, 0);
  assert.equal(near.length, 0);
  assert.equal(unique, 1);
});

test('one existing row satisfies at most one incoming record', () => {
  const inventory = entity('inventory');
  const { exact, unique } = findDuplicates(
    inventory,
    [{ name: 'Rice' }, { name: 'rice' }],
    [{ id: '5', name: 'Rice' }]
  );
  assert.equal(exact.length, 1);
  assert.equal(unique, 1);
});

test('merge fills gaps but never overwrites an existing value', () => {
  const inventory = entity('inventory');
  const merged = applyImportValues(
    inventory,
    { id: '7', name: 'Rice', price: 'GHS 10.00', stock: 5 },
    { name: 'Rice', price: 'GHS 12.00', category: 'Grains' },
    'merge'
  );
  assert.equal(merged.price, 'GHS 10.00');
  assert.equal(merged.category, 'Grains');
  assert.equal(merged.stock, 5);
});

test('replace lets the file win where it has a value but never wipes blanks', () => {
  const inventory = entity('inventory');
  const replaced = applyImportValues(
    inventory,
    { id: '7', name: 'Rice', price: 'GHS 10.00', stock: 5, unit: 'bag' },
    { name: 'rice', price: 'GHS 12.00' },
    'replace'
  );
  assert.equal(replaced.price, 'GHS 12.00');
  assert.equal(replaced.unit, 'bag');
  assert.equal(replaced.stock, 5);
});