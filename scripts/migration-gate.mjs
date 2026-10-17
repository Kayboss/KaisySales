/**
 * Deployment ordering, in pure form.
 *
 * A frontend and its schema have to agree, and the only thing that makes that
 * true is ordering: a migration that adds the column goes out before the screen
 * that reads it. Nothing in the release path checks that today, so a pending
 * migration ships as a silently broken screen rather than a blocked deploy.
 *
 * These helpers compare what is on disk with what production has actually
 * applied. They make no decisions about policy — the CLI does — so they stay
 * unit testable in plain Node with no network.
 */

// Supabase names a migration `<14-digit timestamp>_<label>.sql`. Anything else
// cannot be compared against the applied table, so it is reported rather than
// skipped: a file that cannot be ordered is a file that can be forgotten.
export const MIGRATION_FILE_RE = /^(\d{14})_(.+)\.sql$/;

/** Reads the project ref out of a Supabase URL. */
export const parseProjectRef = (url) => {
  const match = /^[a-z]+:\/\/([^.\/]+)\.supabase\.co/i.exec(String(url || '').replace(/\/+$/, ''));
  return match ? match[1] : null;
};

export const parseMigrationFilename = (filename) => {
  const match = MIGRATION_FILE_RE.exec(String(filename || ''));
  return match
    ? { version: match[1], name: match[2], file: String(filename) }
    : { version: null, name: null, file: String(filename) };
};

/**
 * @param {string[]} filenames bare file names, not paths
 * @returns {{migrations: Array, malformed: string[], duplicateNames: string[]}}
 */
export const loadDiskMigrations = (filenames = []) => {
  const parsed = filenames.map(parseMigrationFilename);
  const malformed = parsed.filter((entry) => !entry.version).map((entry) => entry.file);

  const seen = new Map();
  const duplicateNames = [];
  for (const entry of parsed) {
    if (!entry.version) continue;
    if (seen.has(entry.name)) duplicateNames.push(entry.name);
    else seen.set(entry.name, entry.file);
  }

  const migrations = parsed
    .filter((entry) => entry.version)
    .sort((a, b) => a.version.localeCompare(b.version));

  return { migrations, malformed, duplicateNames };
};

/**
 * Splits the comparison into the one thing that must stop a deploy and the
 * things that only deserve a warning.
 *
 * `unapplied` blocks: the SQL has never run on production, so any screen that
 * depends on it is about to break.
 *
 * `stampMismatch` warns: the SQL ran, but under a different version stamp than
 * the file on disk — usually an apply that went through the SQL editor or a
 * differently-timestamped copy. Blocking here would trap the release behind the
 * very inconsistency it just found, so it is reported and the release continues.
 *
 * `appliedNotOnDisk` warns for the same reason in reverse: production carries
 * schema the repository does not describe.
 */
export const diffMigrations = (disk = [], applied = []) => {
  const appliedVersionByName = new Map(applied.map((row) => [String(row.name), String(row.version)]));
  const appliedNames = new Set(appliedVersionByName.keys());
  const diskNames = new Set(disk.map((entry) => entry.name));

  const unapplied = disk.filter((entry) => !appliedNames.has(entry.name));
  const stampMismatch = disk
    .filter((entry) => appliedNames.has(entry.name) && appliedVersionByName.get(entry.name) !== entry.version)
    .map((entry) => ({ ...entry, appliedVersion: appliedVersionByName.get(entry.name) }));
  const appliedNotOnDisk = applied.filter((row) => !diskNames.has(String(row.name)));

  return { unapplied, stampMismatch, appliedNotOnDisk };
};

/** PostgREST/Management-API responses have arrived in more than one shape. */
export const unwrapRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return null;
};

export const hasBlockingProblems = (report = {}) =>
  Boolean(report.verificationFailed) ||
  (report.malformed?.length ?? 0) > 0 ||
  (report.duplicateNames?.length ?? 0) > 0 ||
  (report.diff?.unapplied?.length ?? 0) > 0;

export const formatReport = (report) => {
  const lines = [];
  const { disk, applied, diff, malformed, duplicateNames, verificationFailed } = report;

  if (verificationFailed) {
    lines.push(`BLOCKED — could not read production migrations: ${verificationFailed}`);
    lines.push('Refusing to deploy a schema ordering we have not checked.');
    return lines;
  }

  lines.push(`project ${report.ref}`);
  lines.push(`disk ${disk.length}, applied ${applied.length}`);

  if (malformed.length > 0) {
    lines.push(`BLOCKED — ${malformed.length} migration file(s) are not named <timestamp>_<label>.sql:`);
    for (const file of malformed) lines.push(`  ${file}`);
  }

  if (duplicateNames.length > 0) {
    lines.push(`BLOCKED — the same migration label appears twice on disk:`);
    for (const name of duplicateNames) lines.push(`  ${name}`);
  }

  if (diff.unapplied.length > 0) {
    lines.push(`BLOCKED — ${diff.unapplied.length} migration(s) on disk have never been applied to production:`);
    for (const entry of diff.unapplied) lines.push(`  ${entry.file}`);
    lines.push('Apply them first (see AGENTS.md -> Supabase -> Management API), then re-run release.');
    lines.push('To ship anyway, when you know the frontend does not depend on them:');
    lines.push('  MIGRATION_GATE=skip npm run release');
  }

  const warnings = [
    ...diff.stampMismatch.map(
      (entry) => `DRIFT  ${entry.name}: applied as ${entry.appliedVersion}, file is ${entry.version}`
    ),
    ...diff.appliedNotOnDisk.map(
      (row) => `ORPHAN ${row.name} (${row.version}) is applied on production but has no file in supabase/migrations`
    ),
  ];

  if (warnings.length > 0) {
    lines.push(`Warnings (${warnings.length}):`);
    for (const warning of warnings) lines.push(`  ${warning}`);
  }

  if (lines.length === 2) lines.push('OK — production matches the migrations in this repository.');
  return lines;
};
