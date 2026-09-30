#!/usr/bin/env node
/**
 * Post-build guard: inspects the shipped bundle for anything that must never
 * reach a browser. The Supabase anon key is expected in the bundle (it is
 * public by design and RLS is the only thing protecting the data), so JWTs are
 * decoded and judged by role: anon passes, service_role fails hard.
 *
 *   node scripts/scan-dist.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt', '.svg', '.webmanifest']);

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

const FATAL = [
  { id: 'supabase_pat', re: /\bsbp_[A-Za-z0-9]{20,}\b/g, desc: 'Supabase personal access token' },
  { id: 'service_role_key_value', re: /\b(?:SUPABASE_)?SERVICE_ROLE(?:_KEY)?\s*[:=]\s*["'`]?[A-Za-z0-9._-]{20,}/g, desc: 'service_role key assigned a literal value' },
  { id: 'private_key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, desc: 'Private key block' },
  { id: 'db_url_with_password', re: /\b(?:postgres|postgresql|mysql|mongodb):\/\/[^:\s/@]+:[^@\s/]{4,}@/g, desc: 'Database URL with inline password' },
  { id: 'aws_akid', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, desc: 'AWS access key id' },
  { id: 'stripe_key', re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, desc: 'Stripe secret key' },
  { id: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, desc: 'Slack token' },
];

function decodeJwtRole(token) {
  try {
    const json = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (TEXT_EXT.has(extname(entry.name).toLowerCase()) && statSync(full).size <= MAX_FILE_BYTES) {
      out.push(full);
    }
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`[dist] FAILED — ${DIST}/ not found. Run the build first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error('[dist] FAILED — no readable files in dist/.');
  process.exit(1);
}

const fatal = [];
const anonKeys = new Set();

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  for (const rule of FATAL) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      fatal.push({ file, rule: rule.id, desc: rule.desc, match: m[0] });
    }
  }

  JWT_RE.lastIndex = 0;
  let jwt;
  while ((jwt = JWT_RE.exec(text)) !== null) {
    const role = decodeJwtRole(jwt[0]);
    if (role === 'service_role') {
      fatal.push({ file, rule: 'service_role_jwt', desc: 'service_role JWT shipped to the browser', match: jwt[0] });
    } else if (role === 'anon') {
      anonKeys.add(jwt[0]);
    } else {
      fatal.push({ file, rule: 'unverified_jwt', desc: 'JWT whose role could not be verified', match: jwt[0] });
    }
  }
}

const bytes = files.reduce((sum, f) => sum + statSync(f).size, 0);
console.log(`[dist] scanned ${files.length} built file(s), ${(bytes / 1024).toFixed(0)} KB`);
console.log(`[dist] public anon key(s) present: ${anonKeys.size} (expected — RLS must protect the data)`);

// The app must refuse to start when Supabase is missing, rather than falling back
// to localStorage and pretending a user's financial records were saved. That
// fail-closed path lives in the bundle, so assert it is still there.
const failClosedMarker = 'Service Temporarily Unavailable';
const bundleText = files
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
if (!bundleText.includes(failClosedMarker)) {
  console.error('');
  console.error(`[dist] FAILED — the configuration-error screen ("${failClosedMarker}") is not in the`);
  console.error('[dist] bundle. A production build with no Supabase credentials would silently fall');
  console.error('[dist] back to localStorage. Check that App.jsx still gates on isSupabaseConfigured.');
  process.exit(1);
}
console.log('[dist] fail-closed config screen present (no silent localStorage fallback)');

if (fatal.length > 0) {
  console.error('');
  console.error('[dist] FAILED — secrets in the production bundle:');
  for (const f of fatal) {
    const shown = f.match.length <= 12 ? f.match : `${f.match.slice(0, 8)}...${f.match.slice(-4)}`;
    console.error(`  ${f.file}: ${f.rule} — ${f.desc} (${shown})`);
  }
  console.error('');
  console.error('[dist] Never ship these. Remove them and rebuild.');
  process.exit(1);
}

console.log('[dist] PASS — no privileged secrets in the bundle');
