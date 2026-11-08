import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INBOX_SEEN_STORAGE_KEY,
  inboxSeenKey,
  readLastSeen,
  writeLastSeen,
  isNewerThan,
  summariseUnseen,
} from '../src/utils/adminInboxSeen.js';

/* The badge used to be "open reports + error users + never signed in". Two of
   those are state, not events, so the number could never fall — the admin read
   the inbox, closed it, and it still said 19. These tests pin the replacement:
   the badge counts what appeared since the last time the inbox was on screen,
   and reading it is what clears it. */

const memory = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    get size() { return store.size; },
  };
};

const throwing = () => ({
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
});

const T0 = '2026-11-08T09:00:00.000Z';
const T1 = '2026-11-08T10:00:00.000Z';
const T2 = '2026-11-08T11:00:00.000Z';

test('the stamp is namespaced per admin login', () => {
  assert.equal(inboxSeenKey('abc'), `${INBOX_SEEN_STORAGE_KEY}:abc`);
  // A login that has not resolved yet must not share a stamp with a real one,
  // or the first render would read somebody else's "seen" state.
  assert.notEqual(inboxSeenKey(undefined), inboxSeenKey('abc'));
});

test('a stamp round-trips, and is written as a canonical UTC instant', () => {
  const store = memory();
  assert.equal(readLastSeen(store, 'admin'), null, 'first visit has no stamp');
  assert.equal(writeLastSeen(store, 'admin', new Date(T1)), true);
  assert.equal(readLastSeen(store, 'admin'), T1);
  // PostgREST's spelling of the same instant must read back identically, or
  // every comparison downstream would be against a different value.
  assert.equal(writeLastSeen(store, 'admin', '2026-11-08T12:00:00+00:00'), true);
  assert.equal(readLastSeen(store, 'admin'), '2026-11-08T12:00:00.000Z');
  // Stamps are per login: another admin does not inherit this one's.
  assert.equal(readLastSeen(store, 'other'), null);
});

test('storage failures degrade to "no stamp", never to a hidden badge', () => {
  assert.equal(readLastSeen(throwing(), 'admin'), null);
  assert.equal(writeLastSeen(throwing(), 'admin'), false);
  assert.equal(writeLastSeen(memory(), 'admin', 'not a date'), false);
  assert.equal(readLastSeen(null, 'admin'), null);

  // A corrupt stamp counts the backlog once instead of hiding it for ever.
  const store = memory();
  store.setItem(inboxSeenKey('admin'), 'garbage');
  assert.equal(readLastSeen(store, 'admin'), null);
});

test('isNewerThan: no stamp means everything is new', () => {
  assert.equal(isNewerThan(T0, null), true);
  assert.equal(isNewerThan(undefined, null), true);
});

test('isNewerThan: strict ordering against the stamp', () => {
  assert.equal(isNewerThan(T0, T1), false, 'older than the stamp is read');
  assert.equal(isNewerThan(T1, T1), false, 'the stamp instant itself is read');
  assert.equal(isNewerThan(T2, T1), true);
});

test('isNewerThan: the two spellings of one instant do not count as new', () => {
  // PostgREST returns "+00:00", toISOString returns "Z". Compared as strings
  // "+00:00" sorts after "Z" and the row would look newer than itself.
  assert.equal(isNewerThan('2026-11-08T09:00:00.000+00:00', T0), false);
  assert.equal(isNewerThan('2026-11-08T09:00:01.000+00:00', T0), true);
});

test('isNewerThan: an unplaceable row cannot pin the badge on for ever', () => {
  assert.equal(isNewerThan('not a date', T1), false, 'unprovable with a stamp present');
  assert.equal(isNewerThan(null, T1), false);
  assert.equal(isNewerThan('not a date', 'also not a date'), true, 'corrupt stamp counts once');
});

test('summariseUnseen: the first visit shows the whole backlog', () => {
  const summary = summariseUnseen({
    reports: [{ id: 'n1', createdAt: T0 }],
    errors: [{ id: 'e1', userId: 'u1', createdAt: T0 }],
    neverSignedIn: [{ id: 'p1', createdAt: T0 }, { id: 'p2', createdAt: T0 }],
    lastSeenAt: null,
  });
  assert.deepEqual(summary, { reports: 1, errorUsers: 1, neverSignedIn: 2, total: 4 });
});

test('summariseUnseen: after reading, only what arrived since counts', () => {
  const summary = summariseUnseen({
    reports: [{ id: 'n-old', createdAt: T0 }, { id: 'n-new', createdAt: T2 }],
    errors: [
      { id: 'e-old', userId: 'u1', createdAt: T0 },
      { id: 'e-new', userId: 'u2', createdAt: T2 },
    ],
    neverSignedIn: [
      { id: 'p-old', createdAt: T0 },
      { id: 'p-new', createdAt: T2 },
      { id: 'p-same', createdAt: T1 },
    ],
    lastSeenAt: T1,
  });
  assert.deepEqual(summary, { reports: 1, errorUsers: 1, neverSignedIn: 1, total: 3 });
});

test('summariseUnseen: ten errors from one account are one thing to look at', () => {
  const summary = summariseUnseen({
    errors: [
      { id: 'e1', userId: 'u1', createdAt: T2 },
      { id: 'e2', userId: 'u1', createdAt: T2 },
      { id: 'e3', userId: 'u2', createdAt: T2 },
      { id: 'e4', userId: 'u1', createdAt: T0 },
    ],
    lastSeenAt: T1,
  });
  assert.equal(summary.errorUsers, 2, 'u1 counts once, and its stale row adds nothing');
  assert.equal(summary.total, 2);
});

test('summariseUnseen: an error with no user cannot be grouped, so it is dropped', () => {
  const summary = summariseUnseen({
    errors: [{ id: 'e1', userId: null, createdAt: T2 }],
    lastSeenAt: T1,
  });
  assert.equal(summary.errorUsers, 0);
});

test('summariseUnseen: the production backlog stops being a permanent 19', () => {
  // Measured from production on 2026-11-08: 17 never-signed-in accounts, 2
  // users with errors, 0 open reports — the exact "inbox 19" that could never
  // be cleared, because looking at those lists changes nothing about them.
  const seenEarlier = { reports: [], lastSeenAt: T1 };
  const backlog = {
    reports: [],
    errors: [
      { id: 'e1', userId: 'u1', createdAt: T0 },
      { id: 'e2', userId: 'u2', createdAt: T0 },
    ],
    neverSignedIn: Array.from({ length: 17 }, (_, i) => ({ id: `p${i}`, createdAt: T0 })),
  };

  assert.equal(summariseUnseen({ ...backlog, ...seenEarlier }).total, 0, 'read: clears');
  assert.equal(summariseUnseen(backlog).total, 19, 'first visit: shows the backlog once');
  assert.equal(
    summariseUnseen({
      ...backlog,
      neverSignedIn: [...backlog.neverSignedIn, { id: 'p18', createdAt: T2 }],
      lastSeenAt: T1,
    }).total,
    1,
    'one new signup: one, and only that one',
  );
});

test('summariseUnseen: missing feeds are zero, not a crash', () => {
  assert.deepEqual(summariseUnseen(), { reports: 0, errorUsers: 0, neverSignedIn: 0, total: 0 });
  assert.deepEqual(
    summariseUnseen({ reports: undefined, errors: null, neverSignedIn: null, lastSeenAt: T1 }),
    { reports: 0, errorUsers: 0, neverSignedIn: 0, total: 0 },
  );
});
