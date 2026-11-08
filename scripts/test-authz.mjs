#!/usr/bin/env node
/**
 * KaisySales authorization (RLS) regression suite.
 *
 * The Supabase anon key is public by design, so database permissions are the ONLY
 * thing stopping one user from reading or writing another user's customers,
 * invoices and balances. No linter, dependency audit, SAST or DAST scanner can prove
 * that, because those permissions live in the database and only take effect when
 * queried. So this suite asks the same questions an attacker would, using nothing
 * but the public anon key, and asserts every door is shut:
 *
 *   A. anon  -> cannot read a single row of any user table
 *   B. anon  -> cannot insert into any user table
 *   F. anon  -> cannot execute any database function
 *   C. userA -> cannot read userB's rows
 *   D. userA -> can read their own rows      (liveness: proves A is not blanket-denied)
 *   E. userA -> cannot update or delete userB's rows
 *   G. userA -> CAN update an audited column on their own row (liveness: the
 *              audit triggers must not reject a legitimate write)
 *   H. userA -> cannot read or claim another business's rows, and an insert that
 *              names another business_id is rewritten to the caller's own
 *   I. staff  -> sees its own branch and not the sibling branch, cannot grant
 *              itself a module, and its expenses are exactly what `reporting`
 *              says they should be
 *
 * A skipped check is reported as SKIP, never as PASS, so a suite that cannot
 * prove something never looks like it did.
 *
 * Usage:  node scripts/test-authz.mjs
 *
 * Environment:
 *   SUPABASE_URL        project URL, e.g. https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY   the public anon key (also read from .env / .env.local)
 *   AUTHZ_USER_A_EMAIL / AUTHZ_USER_A_PASSWORD / AUTHZ_USER_A_ID
 *   AUTHZ_USER_B_EMAIL / AUTHZ_USER_B_PASSWORD / AUTHZ_USER_B_ID
 *   AUTHZ_STAFF_EMAIL / AUTHZ_STAFF_PASSWORD   optional third account that is a
 *                       staff member of user A's business. Section I skips
 *                       without it, because a staff login is the only way to ask
 *                       a branch- or module-scoped question.
 *   AUTHZ_NO_WRITE=1    skip every check that could write: E, G, H's insert probe
 *                       and all of I's row probes
 *
 * Only the anon key is needed for A, B and F. C, D and E need two real accounts;
 * point them at disposable test accounts, never at a customer's.
 *
 * Exit code 0 = every executed check passed. 1 = a check failed or could not run.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ config

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const restBase = `${url}/rest/v1`;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
// Columns to try when probing whether a user can write to another user's rows.
// The first one the table actually has is used, so a table with no matching
// column skips rather than passing vacuously.
const writeProbes = [
  'notes', 'description', 'name', 'title', 'vendor', 'milestone_label',
  'client_name', 'customer', 'item', 'business_name', 'owner_name', 'category',
  'status', 'message', 'content', 'platform_tag', 'location', 'phone',
  'error', 'page', 'entity', 'source', 'referrer',
];
// admin_audit_log is deliberately absent: its policy is `using: is_admin()`, so it
// has no per-user access at all. Both fixture accounts are non-admin, so C/D/E
// cannot be framed against it — a SKIP is the honest verdict, not a missing
// column. Its actor_id is not an owner column in the RLS sense.
const ownerCandidates = ['user_id', 'owner_id', 'created_by'];

// Tables that are deliberately world-readable. subscription_plans is the pricing
// catalogue (free/pro/premium) and holds no customer data — it is read before
// anyone signs in. Its safety is asserted below: it must never gain an owner
// column, at which point this exemption has to be revisited.
const PUBLIC_TABLES = {
  subscription_plans: 'public pricing catalogue, read before sign-in',
};
const DEFAULT_OWNER = { profiles: 'id' };

// Values for building an insert payload that clears PostgREST's column check, so
// the request reaches the permission check instead of dying on validation.
const PROBE_VALUES = [
  [/^(uuid)$/i, '00000000-0000-0000-0000-0000000000ff'],
  [/^(bool(ean)?)$/i, false],
  [/^(smallint|integer|int|bigint|numeric|decimal|real|double precision|money)$/i, 0],
  [/^(date|timestamptz|timestamp|time)$/i, '2000-01-01'],
  [/^(json|jsonb)$/i, {}],
  [/^(text|varchar|character|char|uuid\[\])$/i, 'kaisysales-authz-probe'],
];

const users = {
  A: {
    id: process.env.AUTHZ_USER_A_ID || '',
    email: process.env.AUTHZ_USER_A_EMAIL || '',
    password: process.env.AUTHZ_USER_A_PASSWORD || '',
  },
  B: {
    id: process.env.AUTHZ_USER_B_ID || '',
    email: process.env.AUTHZ_USER_B_EMAIL || '',
    password: process.env.AUTHZ_USER_B_PASSWORD || '',
  },
  // Optional. A staff login cannot be faked from an owner token: every branch and
  // module rule in M1 asks `my_membership()`, which reads the caller's own row.
  STAFF: {
    id: process.env.AUTHZ_STAFF_ID || '',
    email: process.env.AUTHZ_STAFF_EMAIL || '',
    password: process.env.AUTHZ_STAFF_PASSWORD || '',
  },
};

// The tables M1 gave a business_id to. H asks each one directly rather than
// trusting C's owner-column filter, because a row whose user_id happens to be
// right while its business_id points elsewhere would still pass C. `inventory` is
// deliberately absent: 20261104160000 dropped it in favour of products /
// branch_inventory, so naming it here only ever produced a SKIP.
const TENANT_TABLES = [
  'sales', 'invoices', 'expenses', 'stores',
  'categories', 'customers', 'services', 'service_income', 'recurring_income',
];

// A staff row is only meaningful if the tenant rules actually differ from the
// owner's, so the probes pick a module the fixture does not already hold.
const MODULE_NAMES = ['reporting', 'expenses', 'inventory', 'invoices', 'sales', 'customers'];

// ------------------------------------------------------------------ reporting

const results = [];
const record = (id, status, detail) => {
  results.push({ id, status, detail });
  console.log(`  [${status.padEnd(4)}] ${id} — ${detail}`);
};
const pass = (id, detail) => record(id, 'PASS', detail);
const fail = (id, detail) => record(id, 'FAIL', detail);
const skip = (id, detail) => record(id, 'SKIP', detail);

class ConfigError extends Error {}

// ------------------------------------------------------------------ discovery

const SQL_STOPWORDS = new Set([
  'table', 'column', 'constraint', 'index', 'sequence', 'function', 'trigger', 'policy',
  'on', 'and', 'or', 'not', 'null', 'default', 'primary', 'foreign', 'key', 'references',
  'access', 'privileges', 'acl', 'internal', 'public', 'schema', 'role', 'grant', 'revoke',
  'all', 'only', 'to', 'from', 'using', 'check', 'for', 'select', 'insert', 'update',
  'delete', 'create', 'drop', 'alter', 'exists', 'if', 'cascad', 'restrict', 'set', 'values',
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * SQL with comments removed and literals blanked, because discovery reads text
 * and neither is DDL. The header of 20261017134834 says "The RLS SELECT policy
 * filters on user_id", which the POLICY regex below read as `create policy
 * filters on user_id` and answered by probing a table that has never existed.
 * Dollar-quoted bodies are copied verbatim: they are code, and an apostrophe in
 * one of their comments must not be mistaken for the start of a string literal.
 */
function stripSqlComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      i = nl < 0 ? sql.length : nl; // leave the newline for the DDL patterns
      continue;
    }
    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    const dollar = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i, i + 40));
    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      const stop = end < 0 ? sql.length : end + dollar[0].length;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) { j += 2; continue; } // '' escape
        if (sql[j] === ch) { j += 1; break; }
        j += 1;
      }
      out += ch === "'" ? "''" : '""'; // keep the shape, drop the contents
      i = j;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * The column regex captures whatever follows the type (`uuid primary key default
 * gen_random_uuid`), so not one anchored PROBE_VALUES rule matched and
 * probePayload() returned null for every table whose columns all carry inline
 * constraints. The anon insert then fell through to a bare `{ user_id }` body,
 * and PostgREST answered PGRST204 ("no such column") — a schema complaint that
 * proves nothing about permissions. Stop the type at the first constraint word.
 * `timestamp with time zone` survives, because the trim only fires on a whole
 * word and `\bnot\b` does not match inside `without`.
 */
function normalizeColumnType(raw) {
  return raw
    .replace(/\s+(primary|not|null|default|references|unique|check|constraint|generated|collate)\b[\s\S]*$/i, '')
    .trim()
    .toLowerCase();
}

function discover(root = '.') {
  const tables = new Map();
  const functions = new Map();

  const addTable = (name, columns) => {
    const key = name.toLowerCase();
    if (SQL_STOPWORDS.has(key)) return;
    if (!tables.has(key)) tables.set(key, new Set());
    for (const c of columns || []) tables.get(key).add(c);
  };

  // The declared parameter names of a CREATE FUNCTION argument list. Probing a
  // function requires sending the names it actually declares: PostgREST resolves
  // the overload by argument name and replies 404 to anything it does not
  // recognise, which is indistinguishable from "not exposed" unless the names
  // were read from the migration.
  const paramNames = (list) => {
    if (!list || !list.trim()) return '';
    return list
      .split(',')
      .map((part) => part.trim().replace(/^(IN|OUT|INOUT|VARIADIC)\s+/i, ''))
      .map((part) => /"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i.exec(part))
      .filter(Boolean)
      .map((m) => m[1].toLowerCase())
      .join(',');
  };

  // Sorted, because migrations are applied in timestamp order and the scan below
  // honours DROP TABLE: readdir order is not guaranteed on every filesystem, and
  // an unordered scan could let a table survive the migration that dropped it.
  const migrationFiles = walk(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const sql = stripSqlComments(readFileSync(file, 'utf8'));

    // CREATE TABLE name ( col type [constraints], ... ) — keep the columns so we
    // can build a payload that actually reaches the permission check.
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\)\s*(?:;|ENGINE|with)/gi)) {
      const columns = m[2]
        .split(/,(?![^()]*\))/)
        .map((part) => /^\s*"?([a-z_][a-z0-9_]*)"?\s+([a-z][a-z0-9_ ]*(\[\])?)/i.exec(part))
        .filter(Boolean)
        .filter((c) => !/^(primary|foreign|unique|check|constraint|key)$/i.test(c[1]) && !/serial/i.test(c[2]))
        .map((c) => ({ name: c[1].toLowerCase(), type: normalizeColumnType(c[2]) }));
      addTable(m[1], columns.map((c) => c.name));
      tables.get(m[1].toLowerCase()).columns = columns;
    }

    for (const m of sql.matchAll(/(?:ALTER\s+TABLE|POLICY\s+\w+\s+ON|CREATE\s+INDEX[^;]*?\s+ON)\s+(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      addTable(m[1], []);
    }

    // A table the schema retired stops being a table worth probing.
    // 20261104160000 drops `inventory` (products + branch_inventory replaced it),
    // so every check written against it skipped with "table does not exist in the
    // database" — a verdict that reads like coverage and is not. Applying DROP in
    // file order also means a table dropped and re-created is probed again.
    for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^;]+);/gi)) {
      for (const part of m[1].split(',')) {
        const name = /^\s*(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*(?:CASCADE|RESTRICT)?\s*$/i.exec(part);
        if (name) tables.delete(name[1].toLowerCase());
      }
    }

    // Deliberately loose on the return type: requiring a full signature drops
    // trigger functions and RETURNS TABLE(...) bodies, which are the ones worth
    // probing. The parameter list is captured though, because PostgREST answers
    // 404 to an argument name it does not recognise, and a probe that cannot
    // form an accepted request proves nothing about permissions.
    for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi)) {
      functions.set(m[1].toLowerCase(), paramNames(m[2]));
    }
  }

  for (const file of walk(join(root, 'src')).filter((f) => /\.(js|jsx)$/.test(f))) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\.from\(\s*'([a-z_][a-z0-9_]*)'\s*\)/gi)) addTable(m[1], []);
    for (const m of code.matchAll(/UserRecords\(\s*[^,()]+\s*,\s*'([a-z_][a-z0-9_]*)'/gi)) addTable(m[1], []);
    for (const m of code.matchAll(/\.rpc\(\s*'([a-z_][a-z0-9_]*)'/gi)) functions.set(m[1].toLowerCase(), '');
  }

  addTable('profiles', ['id']);
  return { tables: [...tables.keys()].sort(), columns: tables, functions };
}

/**
 * Builds an insert body from a table's known columns so PostgREST accepts the
 * shape and the request is decided by permissions rather than validation.
 */
function probePayload(name, columns) {
  const body = {};
  for (const col of columns || []) {
    const rule = PROBE_VALUES.find(([pattern]) => pattern.test(col.type));
    if (rule) body[col.name] = rule[1];
  }
  return Object.keys(body).length ? body : null;
}

/**
 * Builds an insert body for a table anon can already read, using the columns it
 * actually has. Needed for the deliberately-public tables, where the migration
 * folder has no DDL but the insert must still be provably rejected.
 */
function payloadFromReadableRow(row) {
  const body = {};
  for (const key of Object.keys(row || {})) {
    if (key === 'id' || key.endsWith('_at') || key.endsWith('_id')) continue;
    const value = row[key];
    if (typeof value === 'number' || typeof value === 'boolean') body[key] = value;
    else if (value && typeof value === 'object') body[key] = {};
    else if (/^(name|slug|label|title|description|tier|plan|interval|billing)/.test(key)) body[key] = 'kaisysales-authz-probe';
    else body[key] = 'kaisysales-authz-probe';
  }
  return Object.keys(body).length ? body : null;
}

// ------------------------------------------------------------------ http

async function rest(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${token || anonKey}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  try {
    const res = await fetch(`${restBase}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, count: Array.isArray(json) ? json.length : null, text };
  } catch (err) {
    return { status: 0, json: null, count: null, text: String(err) };
  }
}

const codeOf = (res) => res.json?.code || res.json?.error_code || `HTTP ${res.status}`;
const isDenied = (res) => [401, 403].includes(res.status) || /42501|row-level security|permission denied/i.test(res.text || '');
const isMissingTable = (res) => [404].includes(res.status) && /PGRST205|does not exist/i.test(res.text || '');
// "Table exists but that column does not" — the probe used to discover columns.
const isMissingColumn = (res) => [400, 404].includes(res.status) && /42703|PGRST204|column/i.test(res.text || '');

async function signIn(user) {
  if (!user.email || !user.password) return null;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) return null;
  const token = (await res.json()).access_token || null;
  return token ? { token, id: subjectOf(token) } : null;
}

// The id is read from the token the server just issued, so it cannot drift from
// the account actually signed in. The signature is not verified on purpose: the
// value only ever narrows a row filter in a test, and the token is already trusted
// for every request made with it.
function subjectOf(token) {
  const part = token.split('.')[1];
  if (!part) return '';
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')).sub || '';
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------ suite

async function main() {
  if (!url) throw new ConfigError('SUPABASE_URL is not set');
  if (!anonKey) throw new ConfigError('SUPABASE_ANON_KEY is not set');

  const { tables, columns, functions } = discover();
  console.log('\n[authz] KaisySales authorization suite');
  console.log(`[authz] target: ${url}`);
  console.log(`[authz] discovered ${tables.length} table(s) and ${functions.size} function(s) from supabase/migrations + src\n`);
  if (!tables.length) throw new ConfigError('no tables discovered — the tests would be vacuous');

  // ---- A + B: anonymous callers
  console.log('A. anonymous read must return nothing');
  for (const table of tables) {
    const res = await rest(`/${table}?select=*&limit=5`);
    if (isMissingTable(res)) {
      skip(`A read ${table}`, 'table does not exist in the database');
    } else if (PUBLIC_TABLES[table]) {
      // Exempt by design, but only while it stays ownerless. The moment it gains
      // a user_id it is holding per-user data and this exemption must be revoked.
      const owner = await rest(`/${table}?select=user_id&limit=0`);
      if (owner.status === 200) {
        fail(`A read ${table}`, `public table has an owner column and returns ${res.count} rows`);
      } else {
        pass(`A read ${table}`, `public by design — ${PUBLIC_TABLES[table]} (${res.count} rows, no owner column)`);
      }
    } else if (isDenied(res)) {
      pass(`A read ${table}`, `denied (${codeOf(res)})`);
    } else if (res.status === 200 && res.count === 0) {
      pass(`A read ${table}`, '0 rows visible to anon');
    } else {
      fail(`A read ${table}`, `anon can read ${res.count ?? '?'} row(s) (HTTP ${res.status})`);
    }
  }

  console.log('\nB. anonymous insert must be rejected');
  for (const table of tables) {
    const payload =
      probePayload(table, columns.get(table)?.columns) ||
      (DEFAULT_OWNER[table] ? { [DEFAULT_OWNER[table]]: '00000000-0000-0000-0000-0000000000ff' } : null) ||
      // No DDL in the repo for this table: borrow its real columns from a row anon
      // is allowed to read, so the request is decided by permissions.
      payloadFromReadableRow((await rest(`/${table}?select=*&limit=1`)).json?.[0]) ||
      { user_id: '00000000-0000-0000-0000-0000000000ff' };
    const res = await rest(`/${table}`, { method: 'POST', body: payload, prefer: 'return=minimal' });
    if (isMissingTable(res)) {
      skip(`B insert ${table}`, 'table does not exist in the database');
    } else if (isDenied(res)) {
      pass(`B insert ${table}`, `denied (${codeOf(res)})`);
    } else if (res.status >= 400) {
      skip(`B insert ${table}`, `rejected by ${codeOf(res)} — not provably a permission decision`);
    } else {
      fail(`B insert ${table}`, `anon INSERT accepted (HTTP ${res.status}) — a row may have been created`);
    }
  }

  console.log('\nF. anonymous callers must not execute database functions');
  for (const [fn, signature] of functions) {
    // A function PostgREST cannot match to a signature (PGRST202) or a malformed
    // call (PGRST102) proves nothing about permissions, so every probed shape is
    // classified and only a real permission decision counts as a pass.
    //
    // The declared parameter names come first, because PostgREST resolves a call
    // by argument name and answers 404 to a name it does not know. Probing only
    // `user_id` meant a function with any other parameter was reported as "not
    // exposed" on the strength of a 404 caused by the probe's own bad argument
    // name — normalize_amount(text) was reachable and the suite reported PASS.
    const declared = String(signature || '').split(',').filter(Boolean);
    const shapes = [];
    if (declared.length) {
      const all = Object.fromEntries(declared.map((p) => [p, '00000000-0000-0000-0000-0000000000ff']));
      shapes.push({ label: `declared args ${declared.join(',')}`, body: all });
      for (const p of declared) shapes.push({ label: `declared arg ${p}`, body: { [p]: '00000000-0000-0000-0000-0000000000ff' } });
    }
    shapes.push(
      { label: 'no args', body: {} },
      { label: 'one uuid', body: ['00000000-0000-0000-0000-0000000000ff'] },
      { label: 'named arg', body: { user_id: '00000000-0000-0000-0000-0000000000ff' } },
      { label: 'uuid arg', body: '00000000-0000-0000-0000-0000000000ff' },
    );
    const seen = { denied: null, notExposed: false, executed: null, other: [] };
    for (const shape of shapes) {
      const res = await rest(`/rpc/${fn}`, { method: 'POST', body: shape.body });
      if (isDenied(res)) {
        seen.denied = `denied (${codeOf(res)})`;
        break;
      }
      if (res.status === 404) {
        seen.notExposed = true;
        continue;
      }
      if (res.status >= 200 && res.status < 300) {
        seen.executed = `anon executed ${fn}() with ${shape.label} (HTTP ${res.status})`;
        break;
      }
      seen.other.push(`${shape.label}: ${codeOf(res)}`);
    }

    if (seen.executed) {
      fail(`F rpc ${fn}()`, seen.executed);
    } else if (seen.denied) {
      pass(`F rpc ${fn}()`, seen.denied);
    } else if (seen.notExposed) {
      pass(`F rpc ${fn}()`, 'not exposed to PostgREST — anonymous callers cannot reach it');
    } else {
      skip(`F rpc ${fn}()`, `no shape produced a permission decision (${seen.other.join(', ')})`);
    }
    if (signature) console.log(`         signature: ${signature.slice(0, 80)}`);
  }

  // ---- C + D + E: cross-tenant, needs two real accounts
  const [sessionA, sessionB] = [await signIn(users.A), await signIn(users.B)];

  // A supplied id that disagrees with the account that actually signed in would
  // quietly turn these checks into a comparison against nobody's rows, so it is
  // a hard error rather than something to prefer one side of.
  for (const [label, session, expected] of [['A', sessionA, users.A.id], ['B', sessionB, users.B.id]]) {
    if (session && expected && session.id !== expected) {
      throw new ConfigError(
        `AUTHZ_USER_${label}_ID (${expected}) is not user ${label} (${session.email}), which is ${session.id}`,
      );
    }
  }
  if (sessionA && sessionB) users.A.id = sessionA.id;
  if (sessionB) users.B.id = sessionB.id;
  const tokenA = sessionA && sessionA.token;
  const tokenB = sessionB && sessionB.token;
  const ready = Boolean(tokenA && tokenB && users.A.id && users.B.id && users.A.id !== users.B.id);

  console.log('\nC/D/E. cross-tenant access between two real users');
  if (ready) {
    console.log(`         user A: ${users.A.email} (${users.A.id})`);
    console.log(`         user B: ${users.B.email} (${users.B.id})`);
  }
  if (!ready) {
    const missing = [!tokenA ? 'AUTHZ_USER_A_EMAIL + AUTHZ_USER_A_PASSWORD' : null, !tokenB ? 'AUTHZ_USER_B_EMAIL + AUTHZ_USER_B_PASSWORD' : null]
      .filter(Boolean)
      .join(', ');
    for (const table of tables) {
      skip(`C read others' ${table}`, `needs two signed-in users (missing: ${missing})`);
      skip(`E write others' ${table}`, `needs two signed-in users (missing: ${missing})`);
    }
  } else {
    for (const table of tables) {
      // Discover the ownership column by asking the database whether it exists.
      let owner = null;
      for (const candidate of ownerCandidates.concat(table === 'profiles' ? ['id'] : [])) {
        const probe = await rest(`/${table}?select=${candidate}&limit=0`, { token: tokenA });
        if (probe.status === 200) {
          owner = candidate;
          break;
        }
      }
      if (!owner) {
        skip(`C read others' ${table}`, `no per-user RLS on this table (no ${ownerCandidates.join('/')} column), so there is no cross-tenant question to ask`);
        continue;
      }

      const theirs = await rest(`/${table}?select=*&${owner}=eq.${users.B.id}&limit=5`, { token: tokenA });
      if (isDenied(theirs) || theirs.count === 0) {
        pass(`C read others' ${table}`, isDenied(theirs) ? 'denied' : `0 of user B's rows visible to user A (owner=${owner})`);
      } else {
        fail(`C read others' ${table}`, `user A can read ${theirs.count}+ of user B's rows`);
      }

      const mine = await rest(`/${table}?select=*&${owner}=eq.${users.A.id}&limit=1`, { token: tokenA });
      if (mine.status === 200) {
        pass(`D read own ${table}`, mine.count > 0 ? 'own rows readable' : '0 own rows (fixture account is empty)');
      } else if (isDenied(mine)) {
        fail(`D read own ${table}`, `user A cannot read their own rows (${codeOf(mine)}) — app would be broken`);
      } else {
        fail(`D read own ${table}`, `unexpected HTTP ${mine.status}`);
      }

      if (process.env.AUTHZ_NO_WRITE === '1') {
        skip(`E write others' ${table}`, 'AUTHZ_NO_WRITE=1');
        continue;
      }
      let column = null;
      for (const candidate of writeProbes) {
        const probe = await rest(`/${table}?select=${candidate}&limit=0`, { token: tokenA });
        if (probe.status === 200) {
          column = candidate;
          break;
        }
        if (isMissingColumn(probe)) continue;
      }
      if (!column) {
        skip(`E write others' ${table}`, 'no known text column to probe (set AUTHZ_NO_WRITE or extend writeProbes)');
        continue;
      }

      // Aimed at user B only — use a disposable test account here. If permissions
      // are already broken this does alter that account, which is the point: the
      // test must be capable of failing.
      const upd = await rest(`/${table}?${owner}=eq.${users.B.id}`, {
        method: 'PATCH',
        token: tokenA,
        body: { [column]: 'kaisysales-authz-probe' },
        prefer: 'return=representation',
      });
      if (isDenied(upd) || upd.count === 0) {
        pass(`E update others' ${table}`, isDenied(upd) ? 'denied' : `0 of user B's rows modified (${column})`);
      } else {
        fail(`E update others' ${table}`, `user A MODIFIED ${upd.count} of user B's rows (${column})`);
      }

      const del = await rest(`/${table}?${owner}=eq.${users.B.id}&${column}=eq.kaisysales-authz-probe`, {
        method: 'DELETE',
        token: tokenA,
        prefer: 'return=representation',
      });
      if (isDenied(del) || del.count === 0) {
        pass(`E delete others' ${table}`, isDenied(del) ? 'denied' : `0 of user B's rows deleted (${column})`);
      } else {
        fail(`E delete others' ${table}`, `user A DELETED ${del.count} of user B's rows (${column})`);
      }
    }
  }

  // ---- G: an audited column is still writable by the account that owns it
  //
  // audit_profile_changes and audit_payment_changes call log_admin_action. Those
  // two trigger functions were SECURITY INVOKER, so on a write from the app they
  // ran as `authenticated`, which holds no EXECUTE on log_admin_action (its ACL
  // is postgres + service_role only). Every UPDATE that touched an audited column
  // therefore died with 42501 and rolled back, which silently broke
  // ensureFreeTrial, assignSubscription, cancelSubscription and confirmPayment.
  //
  // Checks A, B and F cannot catch it: they probe the anon key, and the anon key
  // is refused either way. The defect is only visible to a signed-in user, which
  // is exactly why it survived a green suite.
  //
  // The probe writes subscription_expires_at because the trigger audits it but
  // prevent_privilege_escalation deliberately does not guard it (it guards only
  // role, subscription_plan and subscription_status), so the account owner is
  // supposed to be able to write it. The current value is read first and written
  // back afterwards, so the fixture ends exactly as it started.
  console.log('\nG. audit trigger does not reject a legitimate write by the owner');
  if (!ready) {
    skip('G owner updates an audited column', 'needs a signed-in user A');
  } else if (process.env.AUTHZ_NO_WRITE === '1') {
    skip('G owner updates an audited column', 'AUTHZ_NO_WRITE=1');
  } else {
    const readBack = await rest(`/profiles?select=subscription_expires_at&id=eq.${users.A.id}&limit=1`, { token: tokenA });
    const original = readBack.json?.[0]?.subscription_expires_at ?? null;
    const probeValue = '2099-01-01T00:00:00+00:00';
    const restore = () => rest(`/profiles?id=eq.${users.A.id}`, {
      method: 'PATCH',
      token: tokenA,
      body: { subscription_expires_at: original },
    });

    const upd = await rest(`/profiles?id=eq.${users.A.id}`, {
      method: 'PATCH',
      token: tokenA,
      body: { subscription_expires_at: probeValue },
      prefer: 'return=representation',
    });
    if (upd.status === 200 || upd.status === 204) {
      pass('G owner updates an audited column', `subscription_expires_at accepted (${original} -> ${probeValue})`);
      await restore();
    } else {
      fail(
        'G owner updates an audited column',
        `user A cannot write their own audited column (${codeOf(upd)}) — an audit trigger is rejecting a legitimate write, so subscription and free-trial writes are broken`,
      );
    }
  }

  // ---- H + I: tenancy, needs the tenant columns M1 added -------------------
  //
  // The pre-tenancy suite asked "can A read B's rows". That question still had
  // the right answer when every policy was `user_id = auth.uid()`. It stops
  // being sufficient the moment a row belongs to a *business* rather than a
  // person: a staff login's rows carry the staff's own user_id, so an owner
  // reading them is not a cross-user read at all, and a row can be shared by
  // several logins by design. These sections ask the tenant questions instead.
  console.log('\nH. tenancy: one business cannot reach another business\'s rows');

  const membershipOf = async (token, id) => {
    if (!id) return null;
    const res = await rest(
      `/business_members?select=business_id,role,branch_id,modules&user_id=eq.${id}&status=eq.active&limit=1`,
      { token },
    );
    return res.status === 200 ? res.json?.[0] || null : null;
  };

  let bizA = null;
  let bizB = null;
  if (!ready) {
    skip('H cross-business reads', 'needs two signed-in users');
    skip('H insert cannot claim another business', 'needs two signed-in users');
  } else {
    const [memberA, memberB] = [await membershipOf(tokenA, users.A.id), await membershipOf(tokenB, users.B.id)];
    if (!memberA || !memberB) {
      const missing = [!memberA ? 'A' : null, !memberB ? 'B' : null].filter(Boolean).join(' and ');
      skip('H cross-business reads', `user ${missing} has no active business membership — sign in once after the M1–M4 migrations`);
      skip('H insert cannot claim another business', `user ${missing} has no active business membership`);
    } else {
      bizA = memberA.business_id;
      bizB = memberB.business_id;
      if (bizA === bizB) {
        fail('H distinct businesses', 'the two fixture accounts are in the same business, so there is nothing to isolate');
      } else {
        for (const table of TENANT_TABLES) {
          const theirs = await rest(`/${table}?select=id&business_id=eq.${bizB}&limit=5`, { token: tokenA });
          if (isMissingColumn(theirs) || isMissingTable(theirs)) {
            skip(`H read ${table} of another business`, 'table has no business_id column in the database');
          } else if (isDenied(theirs) || theirs.count === 0) {
            pass(`H read ${table} of another business`, isDenied(theirs) ? `denied (${codeOf(theirs)})` : "0 of the other business's rows visible");
          } else {
            fail(`H read ${table} of another business`, `user A can read ${theirs.count}+ of another business's rows`);
          }
        }

        if (process.env.AUTHZ_NO_WRITE === '1') {
          skip('H insert cannot claim another business', 'AUTHZ_NO_WRITE=1');
        } else {
          // The FK does not consult RLS: a row may be shaped with any business_id
          // that exists. The tenant trigger is what rewrites it to the caller's
          // own business, so the check is not "was it refused" (refusal is also
          // safe) but "did anything land in someone else's business".
          const probeName = 'kaisysales-authz-probe';
          const ins = await rest('/categories', {
            method: 'POST',
            token: tokenA,
            body: { name: probeName, type: 'expense', business_id: bizB },
            prefer: 'return=representation',
          });
          if (ins.status >= 200 && ins.status < 300) {
            const row = Array.isArray(ins.json) ? ins.json[0] : ins.json;
            if (row && row.business_id === bizB) {
              fail('H insert cannot claim another business', 'the row was written into another business');
            } else if (row && !row.business_id) {
              skip('H insert cannot claim another business', 'insert accepted with business_id null — the legacy branch, not a tenancy decision');
            } else {
              pass('H insert cannot claim another business', "business_id was rewritten to the caller's own business");
            }
            if (row && row.id) {
              await rest(`/categories?id=eq.${row.id}`, { method: 'DELETE', token: tokenA });
            }
          } else if (isDenied(ins)) {
            pass('H insert cannot claim another business', `denied (${codeOf(ins)})`);
          } else {
            skip('H insert cannot claim another business', `rejected by ${codeOf(ins)} — not provably a tenancy decision`);
          }
        }
      }
    }
  }

  console.log('\nI. tenancy: a staff login is limited to its own branch and modules');
  const sessionStaff = await signIn(users.STAFF);
  const staffMember = sessionStaff ? await membershipOf(sessionStaff.token, sessionStaff.id) : null;
  const staffReady = Boolean(
    sessionStaff && staffMember && bizA && staffMember.business_id === bizA && staffMember.role === 'staff',
  );

  if (!staffReady) {
    const why = !users.STAFF.email || !users.STAFF.password
      ? 'set AUTHZ_STAFF_EMAIL + AUTHZ_STAFF_PASSWORD to a staff login of user A\'s business'
      : !sessionStaff
        ? `could not sign in as ${users.STAFF.email}`
        : !staffMember
          ? `${users.STAFF.email} has no active business membership`
          : staffMember.role !== 'staff'
            ? `${users.STAFF.email} is an owner, not a staff member`
            : !bizA
              ? "user A has no business to compare the staff login against"
              : `${users.STAFF.email} belongs to a different business than user A`;
    for (const id of [
      'I staff reads its own branch (liveness)',
      "I staff cannot read a sibling branch's sales",
      "I staff cannot read a sibling branch's branch_inventory",
      "I staff cannot write a sibling branch's branch_inventory",
      "I staff cannot read a sibling branch's invoices",
      'I staff cannot grant itself a module',
      'I staff cannot reach expenses its modules exclude',
    ]) {
      skip(id, why);
    }
  } else {
    const staffToken = sessionStaff.token;
    const ownBranch = staffMember.branch_id;
    const staffModules = Array.isArray(staffMember.modules) ? staffMember.modules : [];
    const cleanup = [];
    const track = (table, id) => id && cleanup.push({ table, id });

    try {
      const branches = await rest(`/branches?select=id&business_id=eq.${bizA}&archived_at=is.null`, { token: tokenA });
      const sibling = (branches.json || []).map((b) => b.id).find((id) => id !== ownBranch) ?? null;

      if (process.env.AUTHZ_NO_WRITE === '1') {
        for (const id of [
          'I staff reads its own branch (liveness)',
          "I staff cannot read a sibling branch's sales",
          "I staff cannot read a sibling branch's branch_inventory",
          "I staff cannot write a sibling branch's branch_inventory",
          "I staff cannot read a sibling branch's invoices",
          'I staff cannot grant itself a module',
        ]) {
          skip(id, 'AUTHZ_NO_WRITE=1');
        }
      } else if (!sibling) {
        for (const id of [
          'I staff reads its own branch (liveness)',
          "I staff cannot read a sibling branch's sales",
          "I staff cannot read a sibling branch's branch_inventory",
          "I staff cannot write a sibling branch's branch_inventory",
          "I staff cannot read a sibling branch's invoices",
        ]) {
          skip(id, "user A's business has no second branch, so there is no sibling branch to isolate");
        }
      } else {
        // Real rows, created as the owner, so a refusal cannot be confused with
        // "there was nothing there to see". Everything is deleted again below.
        const product = await rest('/products', {
          method: 'POST',
          token: tokenA,
          body: { business_id: bizA, name: 'authz-probe-item', category: 'probe', unit: 'pcs' },
          prefer: 'return=representation',
        });
        const productId = (Array.isArray(product.json) ? product.json[0] : product.json)?.id ?? null;
        track('products', productId);

        if (!productId) {
          for (const id of [
            'I staff reads its own branch (liveness)',
            "I staff cannot read a sibling branch's sales",
            "I staff cannot read a sibling branch's branch_inventory",
            "I staff cannot write a sibling branch's branch_inventory",
            "I staff cannot read a sibling branch's invoices",
          ]) {
            skip(id, `could not create a probe product (${codeOf(product)})`);
          }
        } else {
          const stockAt = async (branchId, stock) => {
            const res = await rest('/branch_inventory', {
              method: 'POST',
              token: tokenA,
              body: { business_id: bizA, branch_id: branchId, product_id: productId, stock, price: '10', cost_price: '5', min_stock: 2, status: 'In Stock' },
              prefer: 'return=representation',
            });
            const id = (Array.isArray(res.json) ? res.json[0] : res.json)?.id ?? null;
            track('branch_inventory', id);
            return id;
          };
          const saleAt = async (branchId) => {
            const res = await rest('/sales', {
              method: 'POST',
              token: tokenA,
              body: {
                business_id: bizA, branch_id: branchId, product_id: productId,
                item: 'authz-probe-item', category: 'probe', quantity: 1, unit_price: 10,
                amount: 'GHS 10.00', payment_method: 'Cash', date: '2000-01-01', time: '00:00', cost: 5,
              },
              prefer: 'return=representation',
            });
            const id = (Array.isArray(res.json) ? res.json[0] : res.json)?.id ?? null;
            track('sales', id);
            return id;
          };

          const siblingStockId = await stockAt(sibling, 3);
          const ownSaleId = ownBranch ? await saleAt(ownBranch) : null;
          const siblingSaleId = await saleAt(sibling);

          // Liveness first: a suite that only ever sees refusals proves nothing.
          if (ownSaleId) {
            const own = await rest(`/sales?select=id&id=eq.${ownSaleId}`, { token: staffToken });
            if (own.count > 0) pass('I staff reads its own branch (liveness)', 'own-branch sale is visible to the staff login');
            else fail('I staff reads its own branch (liveness)', `own-branch sale is NOT visible to the staff login (HTTP ${own.status}) — the branch rule is refusing the staff's own work`);
          } else {
            skip('I staff reads its own branch (liveness)', "could not create a sale at the staff's branch to prove visibility with");
          }

          for (const [label, id, table] of [
            ["I staff cannot read a sibling branch's sales", siblingSaleId, 'sales'],
            ["I staff cannot read a sibling branch's branch_inventory", siblingStockId, 'branch_inventory'],
          ]) {
            if (!id) {
              skip(label, `could not create a ${table} row at the sibling branch to hide`);
              continue;
            }
            const seen = await rest(`/${table}?select=id&id=eq.${id}`, { token: staffToken });
            if (isDenied(seen) || seen.count === 0) {
              pass(label, isDenied(seen) ? `denied (${codeOf(seen)})` : 'sibling-branch row is not visible');
            } else {
              fail(label, `the staff login read a ${table} row from another branch`);
            }
          }

          if (!siblingStockId) {
            skip("I staff cannot write a sibling branch's branch_inventory", 'could not create a sibling-branch stock row to aim at');
          } else {
            const before = await rest(`/branch_inventory?select=stock&id=eq.${siblingStockId}`, { token: tokenA });
            const upd = await rest(`/branch_inventory?id=eq.${siblingStockId}`, {
              method: 'PATCH',
              token: staffToken,
              body: { stock: 999 },
              prefer: 'return=representation',
            });
            const after = await rest(`/branch_inventory?select=stock&id=eq.${siblingStockId}`, { token: tokenA });
            const untouched = after.json?.[0]?.stock === before.json?.[0]?.stock;
            if (isDenied(upd) || (upd.count === 0 && untouched)) {
              pass("I staff cannot write a sibling branch's branch_inventory", isDenied(upd) ? `denied (${codeOf(upd)})` : '0 rows modified, stock unchanged');
            } else {
              fail("I staff cannot write a sibling branch's branch_inventory", `the staff login changed another branch's stock (${before.json?.[0]?.stock} -> ${after.json?.[0]?.stock})`);
            }
          }

          // Invoices have no probe row builder here (their NOT NULL columns are
          // dashboard-created), so this one is only meaningful when the owner
          // already has an invoice at the sibling branch.
          const ownerInvoices = await rest(`/invoices?select=id&branch_id=eq.${sibling}&limit=1`, { token: tokenA });
          if (ownerInvoices.count > 0) {
            const seen = await rest(`/invoices?select=id&branch_id=eq.${sibling}&limit=5`, { token: staffToken });
            if (isDenied(seen) || seen.count === 0) {
              pass("I staff cannot read a sibling branch's invoices", isDenied(seen) ? `denied (${codeOf(seen)})` : "0 of the sibling branch's invoices visible");
            } else {
              fail("I staff cannot read a sibling branch's invoices", `the staff login read ${seen.count} invoice(s) from another branch`);
            }
          } else {
            skip("I staff cannot read a sibling branch's invoices", 'no invoice exists at the sibling branch to hide, and the suite does not build one');
          }
        }
      }

      // Self-grant. The write must either be refused or change nothing: the
      // membership row is the whole permission model, so a staff login that can
      // edit its own `modules` array can hand itself the owner's reports.
      //
      // A self-grant is only visible as a failure if it actually lands, so the row
      // is re-read afterwards instead of trusting the response code — an RLS
      // `using` clause that filters the row makes PostgREST answer 204 with 0 rows
      // changed, which looks identical to a successful write.
      const grantable = MODULE_NAMES.find((name) => !staffModules.includes(name));
      if (process.env.AUTHZ_NO_WRITE === '1') {
        skip('I staff cannot grant itself a module', 'AUTHZ_NO_WRITE=1');
      } else if (!grantable) {
        skip('I staff cannot grant itself a module', `the staff fixture already holds every module the suite knows (${MODULE_NAMES.join(',')})`);
      } else {
        const grant = await rest(`/business_members?business_id=eq.${bizA}&user_id=eq.${sessionStaff.id}`, {
          method: 'PATCH',
          token: staffToken,
          body: { modules: [...staffModules, grantable] },
          prefer: 'return=representation',
        });
        const after = await membershipOf(staffToken, sessionStaff.id);
        const stillHas = Array.isArray(after?.modules) && after.modules.includes(grantable);
        if (isDenied(grant)) {
          pass('I staff cannot grant itself a module', `denied (${codeOf(grant)})`);
        } else if (!stillHas) {
          pass('I staff cannot grant itself a module', `modules stayed ${(after?.modules || []).join(',') || 'empty'}`);
        } else {
          fail('I staff cannot grant itself a module', `the staff login added "${grantable}" to its own modules`);
        }
      }

      // The module gate, not the role gate, is what hides expenses. Whichever way
      // this fixture sits, the expectation is the same rule: `reporting` decides.
      const ownerExpenses = await rest(`/expenses?select=id&business_id=eq.${bizA}&limit=1`, { token: tokenA });
      const staffHasReporting = staffModules.includes('reporting');
      if (ownerExpenses.count === 0) {
        skip('I staff cannot reach expenses its modules exclude', "the business has no expenses for the staff login to be denied");
      } else {
        const seen = await rest(`/expenses?select=id&business_id=eq.${bizA}&limit=5`, { token: staffToken });
        if (staffHasReporting) {
          if (seen.count > 0) pass('I staff cannot reach expenses its modules exclude', 'staff holds `reporting`, and reads expenses as the owner does');
          else fail('I staff cannot reach expenses its modules exclude', `staff holds \`reporting\` but sees none of the business's expenses (HTTP ${seen.status}) — the module gate is refusing a module it was given`);
        } else if (isDenied(seen) || seen.count === 0) {
          pass('I staff cannot reach expenses its modules exclude', isDenied(seen) ? `denied (${codeOf(seen)})` : '0 expenses visible while the owner sees them');
        } else {
          fail('I staff cannot reach expenses its modules exclude', `staff without \`reporting\` read ${seen.count} of the business's expenses`);
        }
      }
    } finally {
      // Owner token, reverse order of creation. Failures here are loud because a
      // probe that cannot clean up litters a real business.
      for (const { table, id } of cleanup.reverse()) {
        if (!id) continue;
        const gone = await rest(`/${table}?id=eq.${id}`, { method: 'DELETE', token: tokenA });
        if (!(gone.status >= 200 && gone.status < 300)) {
          fail(`cleanup ${table} ${id}`, `probe row could not be removed (${codeOf(gone)}) — delete it by hand`);
        }
      }
    }
  }

  // ---- summary
  const failed = results.filter((r) => r.status === 'FAIL');
  const skipped = results.filter((r) => r.status === 'SKIP');
  const passed = results.filter((r) => r.status === 'PASS');
  console.log(`\n[authz] ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`);

  if (skipped.length) {
    console.log('[authz] NOTE: skipped checks verified nothing. A skip is not a pass.');
  }
  if (failed.length) {
    console.error('\n[authz] FAILED — a caller reached data it does not own:\n');
    for (const f of failed) console.error(`  ${f.id}: ${f.detail}`);
    process.exitCode = 1;
    return;
  }
  if (!passed.length) {
    console.error('[authz] FAILED — nothing was actually tested.');
    process.exitCode = 1;
    return;
  }
  console.log('[authz] PASS\n');
}

const selfPath = resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const invokedDirectly = invokedPath !== ''
  && (process.platform === 'win32'
    ? invokedPath.toLowerCase() === selfPath.toLowerCase()
    : invokedPath === selfPath);

// scripts/authz-discovery.test.mjs imports discover() to pin what the scan sees,
// which must not start the live suite — so only run when executed directly.
if (invokedDirectly) {
  try {
    await main();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`\n[authz] CANNOT RUN: ${err.message}\n`);
      console.error('  SUPABASE_URL       e.g. https://<project-ref>.supabase.co');
      console.error('  SUPABASE_ANON_KEY  the public anon key (it already ships in the browser');
      console.error('                    bundle — this is not a privileged credential)\n');
    } else {
      console.error(`\n[authz] ERROR: ${err?.stack || err}\n`);
    }
    process.exitCode = 1;
  }
}

export { discover, probePayload, stripSqlComments };
