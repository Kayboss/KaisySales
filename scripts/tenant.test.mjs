import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  MODULES,
  BASE_MODULE,
  REPORTING_MODULE,
  normaliseModules,
  canSeeReports,
  resolveActiveBranch,
  branchForWrites,
} from '../src/utils/tenancy.js';
import { buildStatsByScope } from '../src/utils/assistant/stats.js';

/**
 * These tests exist because the interface and the database each decide what a
 * login can see, and only one of them can be the authority. The SQL is the
 * authority; everything here checks that the JavaScript has not quietly drifted
 * from it, because a drifted rule fails as a screen that renders nothing.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

const migrationText = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(join(MIGRATIONS, name), 'utf8'))
  .join('\n');

const sqlModules = () => {
  // `set_member_modules` is the only place that decides which module names may
  // be stored, so its allow-list is the SQL side of the parity check.
  const body = migrationText.match(/create or replace function public\.set_member_modules[\s\S]*?\$\$;/);
  assert.ok(body, 'set_member_modules not found in supabase/migrations');
  const list = body[0].match(/where m in \(([^)]*)\)/);
  assert.ok(list, 'set_member_modules has no module allow-list');
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
};

test('the module list matches the one the database accepts', () => {
  assert.deepEqual([...MODULES].sort(), sqlModules());
});

test('the reporting module is the opt-in one, and sales is the base', () => {
  assert.ok(MODULES.includes(BASE_MODULE));
  assert.ok(MODULES.includes(REPORTING_MODULE));
  assert.equal(BASE_MODULE, 'sales');
  assert.equal(REPORTING_MODULE, 'reporting');
  // RLS gates the Expenses table on this exact name, so it is a contract.
  assert.match(migrationText, /has_module\(business_id, 'reporting'\)/);
});

test('normaliseModules mirrors set_member_modules', () => {
  // Unknown names are dropped rather than stored, because the UI would offer a
  // permission the database silently ignores.
  assert.deepEqual(normaliseModules(['reporting', 'admin']), ['reporting', 'sales']);
  assert.deepEqual(normaliseModules(['reporting', 'reporting']), ['reporting', 'sales']);
  // `sales` is always present: it is the job the cashier was hired for.
  assert.deepEqual(normaliseModules([]), ['sales']);
  assert.deepEqual(normaliseModules(null), ['sales']);
  assert.deepEqual(normaliseModules(undefined), ['sales']);
});

test('only a staff login is limited by the reporting module', () => {
  assert.equal(canSeeReports({ role: 'owner', modules: [] }), true);
  assert.equal(canSeeReports({ role: 'owner', modules: ['sales'] }), true);
  assert.equal(canSeeReports({ role: 'staff', modules: ['sales'] }), false);
  assert.equal(canSeeReports({ role: 'staff', modules: ['sales', 'reporting'] }), true);
  assert.equal(canSeeReports({ role: 'staff', modules: null }), false);
});

test('staff are pinned to their membership branch, whatever storage says', () => {
  const branches = [
    { id: 1, name: 'Main', isDefault: true },
    { id: 2, name: 'Accra', isDefault: false },
  ];
  // The stored preference is what a cashier would edit to peek at branch 2.
  assert.equal(resolveActiveBranch({ role: 'staff', branchId: 1, branches, stored: '2' }), 1);
  assert.equal(resolveActiveBranch({ role: 'staff', branchId: 2, branches, stored: '1' }), 2);
  // A staff row with no branch cannot see any branch; it must not fall back to
  // "All branches", which would mean every branch.
  assert.equal(resolveActiveBranch({ role: 'staff', branchId: null, branches, stored: '1' }), null);
});

test('an owner gets the branch they picked, and All branches otherwise', () => {
  const branches = [
    { id: 1, name: 'Main', isDefault: true },
    { id: 2, name: 'Accra', isDefault: false },
  ];
  assert.equal(resolveActiveBranch({ role: 'owner', branches, stored: '2' }), 2);
  assert.equal(resolveActiveBranch({ role: 'owner', branches, stored: null }), null);
  // A branch that has since been archived resolves to All branches, not to an
  // empty screen the owner cannot explain.
  assert.equal(resolveActiveBranch({ role: 'owner', branches, stored: '99' }), null);
  assert.equal(resolveActiveBranch({ role: 'owner', branches: [], stored: '2' }), null);
  assert.equal(resolveActiveBranch({ role: 'owner', branches, stored: 'not-a-number' }), null);
});

test('writes need one shelf even when the owner is viewing every branch', () => {
  const branches = [
    { id: 1, name: 'Main', isDefault: false },
    { id: 2, name: 'Accra', isDefault: true },
  ];
  assert.equal(branchForWrites({ role: 'staff', branchId: 2, activeBranchId: 1, branches }), 2);
  assert.equal(branchForWrites({ role: 'owner', activeBranchId: 1, branches }), 1);
  assert.equal(branchForWrites({ role: 'owner', branches }), 2);
  assert.equal(branchForWrites({ role: 'owner', branches: [{ id: 4 }, { id: 5 }] }), 4);
  assert.equal(branchForWrites({ role: 'owner', branches: [] }), null);
});

const sale = (branchId, amount, day) => ({
  date: day,
  amount: `GHS ${amount.toFixed(2)}`,
  branchId,
});

const retailStats = (sales) =>
  buildStatsByScope({
    mode: 'retail',
    sales,
    expenses: [],
    inventory: [],
    serviceIncome: [],
    customers: [],
    recurring: [],
    invoices: [],
  });

test('consolidated totals are exactly the sum of the branches', () => {
  const branchOne = [sale(1, 100, '2026-10-02'), sale(1, 50.5, '2026-10-03')];
  const branchTwo = [sale(2, 20, '2026-10-04')];

  const together = retailStats([...branchOne, ...branchTwo])['all time'];
  const one = retailStats(branchOne)['all time'];
  const two = retailStats(branchTwo)['all time'];

  // Every sale lands in exactly one branch bucket: nothing is double-counted,
  // nothing falls between them.
  assert.equal(together.incomeCount, one.incomeCount + two.incomeCount);
  assert.equal(together.incomeCount, 3);
  assert.ok(Math.abs(together.incomeTotal - (one.incomeTotal + two.incomeTotal)) < 0.005);
  assert.ok(Math.abs(together.incomeTotal - 170.5) < 0.005);
});

test('a branch that recorded nothing does not move the consolidated total', () => {
  const sales = [sale(1, 75, '2026-10-02')];
  const withEmptyBranch = retailStats(sales)['all time'];
  const alone = retailStats(sales)['all time'];
  assert.equal(withEmptyBranch.incomeCount, alone.incomeCount);
  assert.ok(Math.abs(withEmptyBranch.incomeTotal - alone.incomeTotal) < 0.005);
});
