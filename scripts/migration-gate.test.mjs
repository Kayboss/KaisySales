import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseProjectRef,
  parseMigrationFilename,
  loadDiskMigrations,
  diffMigrations,
  unwrapRows,
  hasBlockingProblems,
  formatReport,
} from './migration-gate.mjs';

const diskOf = (...names) => loadDiskMigrations(names).migrations;

test('parseProjectRef reads the ref out of the project URL', () => {
  assert.equal(parseProjectRef('https://mjrfvwtgoiukpbpdpuvq.supabase.co'), 'mjrfvwtgoiukpbpdpuvq');
  assert.equal(parseProjectRef('https://mjrfvwtgoiukpbpdpuvq.supabase.co/'), 'mjrfvwtgoiukpbpdpuvq');
  assert.equal(parseProjectRef(''), null);
  assert.equal(parseProjectRef('https://example.com'), null);
});

test('a migration file name carries the version and the label', () => {
  assert.deepEqual(parseMigrationFilename('20261017132930_assistant_parses_feedback.sql'), {
    version: '20261017132930',
    name: 'assistant_parses_feedback',
    file: '20261017132930_assistant_parses_feedback.sql',
  });
  assert.equal(parseMigrationFilename('notes.sql').version, null);
});

test('a file that cannot be ordered is reported, not silently skipped', () => {
  const { migrations, malformed } = loadDiskMigrations([
    '20261017132930_assistant_parses_feedback.sql',
    'add-column.sql',
  ]);
  assert.deepEqual(malformed, ['add-column.sql']);
  assert.equal(migrations.length, 1);
});

test('the same label twice on disk is reported', () => {
  const { duplicateNames } = loadDiskMigrations([
    '20261017132930_helper_indexes.sql',
    '20261017140000_helper_indexes.sql',
  ]);
  assert.deepEqual(duplicateNames, ['helper_indexes']);
});

test('unapplied migrations are the ones that block a deploy', () => {
  const diff = diffMigrations(
    diskOf('20261001000000_x.sql', '20261002000000_y.sql'),
    [{ version: '20261001000000', name: 'x' }]
  );
  assert.deepEqual(diff.unapplied.map((entry) => entry.name), ['y']);
  assert.deepEqual(diff.appliedNotOnDisk, []);
  assert.equal(hasBlockingProblems({ diff, malformed: [], duplicateNames: [] }), true);
});

test('a matching disk and production is clean', () => {
  const disk = diskOf('20261017132930_a.sql', '20261017134834_b.sql');
  const diff = diffMigrations(disk, [
    { version: '20261017132930', name: 'a' },
    { version: '20261017134834', name: 'b' },
  ]);
  assert.deepEqual(diff, { unapplied: [], stampMismatch: [], appliedNotOnDisk: [] });
  assert.equal(hasBlockingProblems({ diff, malformed: [], duplicateNames: [] }), false);
});

// The live case that started this gate: assistant_parses_review_indexes ran under
// one timestamp in production while the file on disk carried another. The SQL did
// run, so it warns rather than blocking.
test('the same migration applied under a different stamp is a warning', () => {
  const disk = diskOf(
    '20261017132930_assistant_parses_feedback.sql',
    '20261017140000_assistant_parses_review_indexes.sql'
  );
  const diff = diffMigrations(disk, [
    { version: '20261017132930', name: 'assistant_parses_feedback' },
    { version: '20261017134834', name: 'assistant_parses_review_indexes' },
  ]);
  assert.deepEqual(diff.unapplied, []);
  assert.equal(diff.stampMismatch.length, 1);
  assert.equal(diff.stampMismatch[0].appliedVersion, '20261017134834');
  assert.equal(diff.stampMismatch[0].version, '20261017140000');
  assert.equal(hasBlockingProblems({ diff, malformed: [], duplicateNames: [] }), false);
});

test('schema applied with no file in the repository is a warning', () => {
  const diff = diffMigrations(diskOf('20261001000000_x.sql'), [
    { version: '20261001000000', name: 'x' },
    { version: '20261002000000', name: 'hand_edited' },
  ]);
  assert.deepEqual(diff.appliedNotOnDisk, [{ version: '20261002000000', name: 'hand_edited' }]);
  assert.deepEqual(diff.unapplied, []);
});

test('a failure to reach production blocks the deploy', () => {
  assert.equal(hasBlockingProblems({ verificationFailed: 'management API answered 401' }), true);
});

test('the management API response is read whichever shape it arrives in', () => {
  assert.deepEqual(unwrapRows([{ version: '1', name: 'a' }]), [{ version: '1', name: 'a' }]);
  assert.deepEqual(unwrapRows({ result: [{ version: '1', name: 'a' }] }), [{ version: '1', name: 'a' }]);
  assert.deepEqual(unwrapRows({ rows: [{ version: '1', name: 'a' }] }), [{ version: '1', name: 'a' }]);
  assert.equal(unwrapRows({ unexpected: true }), null);
});

test('the report names the blocker and how to get past it', () => {
  const disk = diskOf('20261017150000_new_table.sql');
  const report = {
    ref: 'mjrfvwtgoiukpbpdpuvq',
    disk,
    applied: [],
    diff: diffMigrations(disk, []),
    malformed: [],
    duplicateNames: [],
    verificationFailed: null,
  };
  const text = formatReport(report).join('\n');
  assert.match(text, /BLOCKED/);
  assert.match(text, /20261017150000_new_table\.sql/);
  assert.match(text, /MIGRATION_GATE=skip/);
  assert.match(text, /Apply them first/);
});

test('a verified match says so in one line', () => {
  const disk = diskOf('20261017132930_a.sql');
  const report = {
    ref: 'mjrfvwtgoiukpbpdpuvq',
    disk,
    applied: [{ version: '20261017132930', name: 'a' }],
    diff: diffMigrations(disk, [{ version: '20261017132930', name: 'a' }]),
    malformed: [],
    duplicateNames: [],
    verificationFailed: null,
  };
  const lines = formatReport(report);
  assert.match(lines.join('\n'), /OK — production matches/);
});

test('a read failure is reported as a blocker with its reason', () => {
  const lines = formatReport({
    ref: 'x',
    disk: [],
    applied: [],
    diff: diffMigrations([], []),
    malformed: [],
    duplicateNames: [],
    verificationFailed: 'SUPABASE_ACCESS_TOKEN is not set',
  });
  assert.match(lines[0], /BLOCKED — could not read production migrations/);
  assert.match(lines.join('\n'), /SUPABASE_ACCESS_TOKEN/);
});
