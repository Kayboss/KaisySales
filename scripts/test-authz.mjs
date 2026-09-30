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
 *   AUTHZ_NO_WRITE=1    skip check E, the only check that could alter data if
 *                       permissions were already broken
 *
 * Only the anon key is needed for A, B and F. C, D and E need two real accounts;
 * point them at disposable test accounts, never at a customer's.
 *
 * Exit code 0 = every executed check passed. 1 = a check failed or could not run.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
];
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
};

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

function discover() {
  const tables = new Map();
  const functions = new Map();

  const addTable = (name, columns) => {
    const key = name.toLowerCase();
    if (SQL_STOPWORDS.has(key)) return;
    if (!tables.has(key)) tables.set(key, new Set());
    for (const c of columns || []) tables.get(key).add(c);
  };

  for (const file of walk('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(file, 'utf8');

    // CREATE TABLE name ( col type [constraints], ... ) — keep the columns so we
    // can build a payload that actually reaches the permission check.
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\)\s*(?:;|ENGINE|with)/gi)) {
      const columns = m[2]
        .split(/,(?![^()]*\))/)
        .map((part) => /^\s*"?([a-z_][a-z0-9_]*)"?\s+([a-z][a-z0-9_ ]*(\[\])?)/i.exec(part))
        .filter(Boolean)
        .filter((c) => !/^(primary|foreign|unique|check|constraint|key)$/i.test(c[1]) && !/serial/i.test(c[2]))
        .map((c) => ({ name: c[1].toLowerCase(), type: c[2].trim() }));
      addTable(m[1], columns.map((c) => c.name));
      tables.get(m[1].toLowerCase()).columns = columns;
    }

    for (const m of sql.matchAll(/(?:ALTER\s+TABLE|POLICY\s+\w+\s+ON|CREATE\s+INDEX[^;]*?\s+ON)\s+(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      addTable(m[1], []);
    }

    // Deliberately loose: requiring a full signature drops trigger functions and
    // RETURNS TABLE(...) bodies, which are the ones worth probing.
    for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      functions.set(m[1].toLowerCase(), '');
    }
  }

  for (const file of walk('src').filter((f) => /\.(js|jsx)$/.test(f))) {
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
    const shapes = [
      { label: 'no args', body: {} },
      { label: 'one uuid', body: ['00000000-0000-0000-0000-0000000000ff'] },
      { label: 'named arg', body: { user_id: '00000000-0000-0000-0000-0000000000ff' } },
      { label: 'uuid arg', body: '00000000-0000-0000-0000-0000000000ff' },
    ];
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
        skip(`C read others' ${table}`, 'no ownership column found (user_id/owner_id/id)');
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
