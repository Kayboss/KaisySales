/**
 * Pins what scripts/test-authz.mjs sees when it reads the migration folder.
 *
 * Discovery works on SQL text, and text is not DDL. Two names it used to invent
 * cost seven checks that reported SKIP — a verdict that is honest but still reads
 * like coverage:
 *
 *   `user_id`  the header of 20261017134834 says "The RLS SELECT policy filters on
 *              user_id", which /POLICY\s+\w+\s+ON/ read as a CREATE POLICY.
 *   `inventory` 20261104160000 drops it (products + branch_inventory replaced it),
 *              so every A/B/C/H check against it answered "table does not exist".
 *
 * A SKIP is never a PASS, which is why these assertions exist: the suite can only
 * be trusted about the tables it actually names, and these are pure (no network).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discover, probePayload, stripSqlComments } from './test-authz.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a comment is not DDL', () => {
  const sql = '-- The RLS SELECT policy filters on user_id on every panel read\nselect 1;';
  assert.equal(stripSqlComments(sql).includes('user_id'), false);

  const { tables } = discover(ROOT);
  assert.equal(
    tables.includes('user_id'),
    false,
    'user_id appears only in a comment (20261017134834) — it is not a table',
  );
});

test('a dropped table stops being probed', () => {
  const { tables } = discover(ROOT);
  assert.equal(
    tables.includes('inventory'),
    false,
    '20261104160000_m4_contract.sql drops public.inventory',
  );
  // The tables that replaced it are still discovered, so the drop did not gut
  // discovery — only the retired name.
  assert.ok(tables.includes('products'));
  assert.ok(tables.includes('branch_inventory'));
});

test('literals cannot invent names, and dollar-quoted bodies survive', () => {
  const out = stripSqlComments("select 'policy x on ghost_table'; -- policy y on ghost2");
  assert.equal(/ghost/.test(out), false);

  // An apostrophe inside a function body's comment must not be read as a string,
  // so bodies are copied verbatim rather than reinterpreted.
  const body = "as $$\n  -- don't reformat\n  begin return 1; end;\n$$;";
  assert.equal(stripSqlComments(body), body);
});

test('stripping keeps the newline between statements', () => {
  const out = stripSqlComments('create table a (id int); -- note\ncreate table b (id int);');
  assert.ok(out.includes('create table a'));
  assert.ok(out.includes('create table b'));
  assert.equal(out.includes('note'), false);
});

test('column types are normalised, so a probe body can be built', () => {
  const { columns } = discover(ROOT);
  const typeOf = (table, column) =>
    (columns.get(table)?.columns || []).find((c) => c.name === column)?.type;

  // The raw capture used to be `uuid primary key default gen_random_uuid`, which
  // matched no PROBE_VALUES rule and left the payload empty.
  assert.equal(typeOf('businesses', 'id'), 'uuid');
  assert.equal(typeOf('businesses', 'created_at'), 'timestamptz');
  assert.equal(typeOf('branch_inventory', 'branch_id'), 'bigint');
  assert.equal(typeOf('business_invites', 'code'), 'text');

  for (const table of ['businesses', 'products', 'branch_inventory', 'business_invites']) {
    for (const col of columns.get(table)?.columns || []) {
      assert.equal(
        /primary|default|references|not null|unique/i.test(col.type),
        false,
        `${table}.${col.name} type still carries a constraint: ${col.type}`,
      );
    }
  }
});

test('every probed table yields a body, so an anon insert is decided by permissions', () => {
  const { columns } = discover(ROOT);

  // These four were the PGRST204 skips: a null payload sent `{ user_id }`, a
  // column none of them has, so PostgREST refused the shape before the grant.
  for (const table of ['businesses', 'products', 'branch_inventory', 'business_invites']) {
    const payload = probePayload(table, columns.get(table)?.columns);
    assert.ok(payload, `${table} must produce a probe body`);

    const declared = new Set((columns.get(table)?.columns || []).map((c) => c.name));
    for (const key of Object.keys(payload)) {
      assert.ok(declared.has(key), `${table}.${key} is not a declared column`);
    }
    for (const value of Object.values(payload)) {
      assert.notEqual(value, undefined);
    }
    // The exact bug: `user_id` is the fallback for the user-scoped tables, and it
    // does not exist here, so sending it proved nothing.
    assert.equal('user_id' in payload, false, `${table} has no user_id column`);
  }

  // The 14 tables with no DDL in the repo are still probed through a readable row
  // or the `user_id` fallback; that path is fine because those tables do have a
  // user_id. If one of them ever gains one, B starts skipping — which is why this
  // list is asserted rather than assumed.
  const modelled = ['acquisition', 'admin_audit_log', 'assistant_parses', 'branch_inventory',
    'branches', 'business_invites', 'business_members', 'businesses', 'products', 'services',
    'user_actions'];
  for (const table of modelled) {
    assert.ok(probePayload(table, columns.get(table)?.columns), `${table} must stay modelled`);
  }
});

test('the live schema is still discovered in full', () => {
  const { tables, functions } = discover(ROOT);

  assert.equal(tables.length, 25, `discovered ${tables.length} tables: ${tables.join(', ')}`);
  assert.equal(functions.size, 48, `discovered ${functions.size} functions`);

  for (const table of [
    'profiles', 'sales', 'invoices', 'expenses', 'customers', 'categories',
    'stores', 'services', 'service_income', 'recurring_income', 'page_visits',
    'user_actions', 'assistant_parses', 'businesses', 'branches',
    'business_members', 'business_invites', 'products', 'branch_inventory',
    'acquisition', 'subscription_plans', 'subscription_payments', 'support_notes',
    'error_logs', 'admin_audit_log',
  ]) {
    assert.ok(tables.includes(table), `${table} must still be discovered`);
  }

  // Section F probes every discovered function with the parameter names the
  // migration declares, so a parse regression here silently narrows that check.
  for (const fn of [
    'is_admin', 'my_membership', 'is_business_member', 'can_see_branch',
    'record_sale', 'void_sale', 'set_member_modules', 'purge_user_account',
    'admin_user_stats', 'admin_visit_days', 'invoice_numeric',
  ]) {
    assert.ok(functions.has(fn), `${fn} must still be discovered`);
  }
});
