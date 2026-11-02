#!/usr/bin/env node
/**
 * Blocks a production deploy when a migration on disk has never been applied.
 *
 * The deploy itself is not the risky half of a release — the frontend is. A
 * screen that reads a column the database has not gained yet fails for every
 * user, and nothing in Gate 1 can see it: lint, audit, SAST and the build all
 * look at the code, not at what production actually holds. So the check runs
 * between Gate 1 and `vercel --prod`, and it fails closed — if production
 * migrations cannot be read, the deploy does not happen.
 *
 * Drift (applied under a different stamp, or applied with no file here) only
 * warns: blocking would trap the release behind the very inconsistency it found.
 *
 * Needs SUPABASE_ACCESS_TOKEN — the same personal access token that applies
 * migrations through the Management API. Read-only: the query selects from
 * supabase_migrations.schema_migrations and writes nothing. The read is retried
 * a few times because the API is intermittently slow, but a failure that
 * survives the retries still blocks the deploy.
 *
 * Exit 0 = safe to deploy. 1 = do not deploy.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadDiskMigrations,
  parseProjectRef,
  diffMigrations,
  unwrapRows,
  hasBlockingProblems,
  formatReport,
  isRetryableStatus,
  retryDelayMs,
  describeFetchError,
  READ_ATTEMPTS,
  READ_TIMEOUT_MS,
} from './migration-gate.mjs';

// Same .env handling as scripts/test-authz.mjs: real environment wins, then
// .env.local, then .env. Values are never printed.
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const say = (text) => console.log(`[migrations] ${text}`);

if (process.env.MIGRATION_GATE === 'skip') {
  say('SKIPPED by MIGRATION_GATE=skip — production schema ordering was not verified.');
  process.exit(0);
}

const ref =
  parseProjectRef(process.env.VITE_SUPABASE_URL) || (process.env.SUPABASE_PROJECT_REF || '').trim() || null;
const token = process.env.SUPABASE_ACCESS_TOKEN || '';
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

const diskFiles = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'))
  : [];
const { migrations: disk, malformed, duplicateNames } = loadDiskMigrations(diskFiles);

const report = {
  ref: ref || '(no project ref)',
  disk,
  applied: [],
  diff: diffMigrations(disk, []),
  malformed,
  duplicateNames,
  verificationFailed: null,
};

if (!ref) {
  report.verificationFailed = 'no project ref — set VITE_SUPABASE_URL or SUPABASE_PROJECT_REF';
} else if (!token) {
  report.verificationFailed =
    'SUPABASE_ACCESS_TOKEN is not set — add it to .env (gitignored) or export it before releasing';
}

// One read attempt. Returns either the applied rows, or a reason plus whether
// another try could plausibly answer differently.
const readApplied = async () => {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'select version, name from supabase_migrations.schema_migrations order by version',
    }),
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    const hint = text.trim().slice(0, 200);
    return {
      retryable: isRetryableStatus(response.status),
      reason: `management API answered ${response.status}${hint ? `: ${hint}` : ''}`,
    };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { retryable: true, reason: 'management API returned a body that is not JSON' };
  }

  const rows = unwrapRows(payload);
  if (rows === null) {
    return { retryable: false, reason: 'unexpected response shape from the management API' };
  }
  return { rows };
};

if (!report.verificationFailed) {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    let outcome;
    try {
      outcome = await readApplied();
    } catch (error) {
      outcome = { retryable: true, reason: describeFetchError(error) };
    }

    if (Array.isArray(outcome.rows)) {
      report.applied = outcome.rows.map((row) => ({ version: String(row.version), name: String(row.name) }));
      report.diff = diffMigrations(disk, report.applied);
      break;
    }

    const last = attempt === READ_ATTEMPTS || !outcome.retryable;
    if (last) {
      const tries = `${attempt} attempt${attempt === 1 ? '' : 's'}, ${READ_TIMEOUT_MS / 1000}s timeout each`;
      report.verificationFailed = `${outcome.reason} (${tries})`;
      break;
    }

    const delay = retryDelayMs(attempt);
    say(`attempt ${attempt}/${READ_ATTEMPTS} failed: ${outcome.reason} — retrying in ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

for (const line of formatReport(report)) say(line);

// process.exit() here would tear the process down while libuv is still closing
// the fetch socket, which on Windows kills the process with an assertion and a
// non-zero code even when the gate passed. Letting Node exit naturally keeps the
// real outcome (0 = safe to deploy, 1 = blocked) intact.
process.exitCode = hasBlockingProblems(report) ? 1 : 0;
