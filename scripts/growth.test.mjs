import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUCH_STORAGE_KEY,
  UNATTRIBUTED,
  hostOf,
  parseAcquisition,
  readTouch,
  rememberTouch,
  clearTouch,
  hasRecorded,
  distinctVisitDays,
  summariseFunnel,
} from '../src/utils/growth.js';

/* Acquisition is a write-once fact and the funnel is the only thing that says
   whether a channel is worth paying for, so both are pinned down here. The
   failure this guards against is subtle: an "activation rate" that counts the
   same person twice, or a first touch that a later page view silently replaces,
   reads as a healthy funnel while nothing is actually working. */

const memory = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    get size() { return store.size; },
  };
};

const OWN = 'kaisy-sales.vercel.app';

test('a campaign tag is read as the source', () => {
  const touch = parseAcquisition({
    search: '?utm_source=whatsapp&utm_medium=group&utm_campaign=launch&utm_content=voice_note&utm_term=invoice',
    pathname: '/login',
    ownHost: OWN,
  });
  assert.deepEqual(
    { source: touch.source, medium: touch.medium, campaign: touch.campaign, content: touch.content, term: touch.term },
    { source: 'whatsapp', medium: 'group', campaign: 'launch', content: 'voice_note', term: 'invoice' },
  );
  assert.equal(touch.landingPage, '/login');
});

test('without a campaign tag the referring host is the source', () => {
  const touch = parseAcquisition({ referrer: 'https://www.facebook.com/groups/123/posts/9', ownHost: OWN });
  assert.equal(touch.source, 'facebook.com');
  assert.match(touch.referrer, /groups\/123/);
});

test('a campaign tag beats the referrer', () => {
  const touch = parseAcquisition({
    search: '?utm_source=instagram',
    referrer: 'https://www.facebook.com/',
    ownHost: OWN,
  });
  assert.equal(touch.source, 'instagram');
});

test('moving between our own pages is not a channel', () => {
  const touch = parseAcquisition({ referrer: `https://${OWN}/landing/`, ownHost: OWN });
  assert.equal(touch.source, 'direct');
});

test('nothing at all is a direct visit, never an empty source', () => {
  const touch = parseAcquisition({ pathname: '/login', ownHost: OWN });
  assert.equal(touch.source, 'direct');
  assert.equal(touch.medium, '');
  assert.equal(touch.landingPage, '/login');
  assert.equal(touch.landingPage.length > 0, true);
});

test('campaign values are trimmed and capped so one URL cannot bloat a row', () => {
  const long = 'x'.repeat(400);
  const touch = parseAcquisition({ search: `?utm_source=%20${long}%20`, ownHost: OWN });
  assert.equal(touch.source.length, 120);
  assert.equal(touch.source, `x`.repeat(120));
});

test('a host is normalised, and a non-URL referrer is not a host', () => {
  assert.equal(hostOf('https://WWW.Facebook.com/x'), 'facebook.com');
  assert.equal(hostOf('not a url'), '');
  assert.equal(hostOf(''), '');
});

test('the first touch of a session wins, even if a later page has a campaign tag', () => {
  const storage = memory();
  const first = rememberTouch(storage, {
    href: 'https://kaisy-sales.vercel.app/landing/index.html',
    referrer: 'https://www.facebook.com/groups/123',
    ownHost: OWN,
  });
  assert.equal(first.source, 'facebook.com');

  const second = rememberTouch(storage, {
    href: 'https://kaisy-sales.vercel.app/login?utm_source=instagram',
    ownHost: OWN,
  });
  assert.equal(second.source, 'facebook.com');
  assert.equal(readTouch(storage).source, 'facebook.com');
});

test('the touch survives a navigation, which is the whole point of storing it', () => {
  const storage = memory();
  rememberTouch(storage, { href: 'https://kaisy-sales.vercel.app/login?utm_source=tiktok', ownHost: OWN });
  assert.equal(storage.size, 1);
  assert.equal(readTouch(storage).source, 'tiktok');
  assert.equal(readTouch(storage).landingPage, '/login');
});

test('a storage that refuses to write loses attribution, not the page', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  assert.equal(readTouch(broken), null);
  const touch = rememberTouch(broken, { href: 'https://kaisy-sales.vercel.app/login', ownHost: OWN });
  assert.equal(touch.source, 'direct');
  assert.doesNotThrow(() => clearTouch(broken));
});

test('a corrupt or empty stored value is ignored rather than trusted', () => {
  const storage = memory();
  storage.setItem(TOUCH_STORAGE_KEY, 'not json');
  assert.equal(readTouch(storage), null);
  storage.setItem(TOUCH_STORAGE_KEY, JSON.stringify({ source: '' }));
  assert.equal(readTouch(storage), null);
  storage.setItem(TOUCH_STORAGE_KEY, JSON.stringify({ source: 'whatsapp', landingPage: '' }));
  assert.equal(readTouch(storage).landingPage, '/');
});

test('a touch can be cleared once it has been recorded', () => {
  const storage = memory();
  rememberTouch(storage, { href: 'https://kaisy-sales.vercel.app/login?utm_source=whatsapp', ownHost: OWN });
  clearTouch(storage);
  assert.equal(readTouch(storage), null);
});

test('any one record of any kind means the account has been used', () => {
  for (const key of [
    'salesCount', 'invoiceCount', 'expenseCount',
    'inventoryCount', 'customerCount', 'serviceIncomeCount', 'recurringIncomeCount',
  ]) {
    assert.equal(hasRecorded({ [key]: 1 }), true, key);
  }
  assert.equal(hasRecorded({}), false);
  assert.equal(hasRecorded({ salesCount: 0, expenseCount: 0 }), false);
});

test('coming back means a second day, not a second page view', () => {
  const days = distinctVisitDays([
    { userId: 'a', createdAt: '2026-11-01T09:00:00Z' },
    { userId: 'a', createdAt: '2026-11-01T18:00:00Z' },
    { userId: 'b', createdAt: '2026-11-01T09:00:00Z' },
    { userId: 'b', createdAt: '2026-11-02T08:00:00Z' },
    { userId: null, createdAt: '2026-11-02T08:00:00Z' },
    { userId: 'c' },
  ]);
  assert.equal(days.get('a').size, 1);
  assert.equal(days.get('b').size, 2);
  assert.equal(days.has('c'), false);
});

test('the funnel starts at signups and never exceeds the stage before it', () => {
  const funnel = summariseFunnel({
    profiles: [
      { id: 'a', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'b', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'c', lastSignInAt: null },
    ],
    stats: [
      { id: 'a', expenseCount: 3 },
      { id: 'b' },
      { id: 'c', salesCount: 2 },
    ],
    visits: [
      { userId: 'a', createdAt: '2026-11-01T10:00:00Z' },
      { userId: 'a', createdAt: '2026-11-02T10:00:00Z' },
      { userId: 'b', createdAt: '2026-11-01T11:00:00Z' },
    ],
    acquisition: [
      { userId: 'a', source: 'whatsapp' },
      { userId: 'b', source: 'whatsapp' },
    ],
  });

  assert.deepEqual(funnel.stages.map((s) => s.count), [3, 2, 1, 1]);
  assert.equal(funnel.total, 3);
  assert.equal(funnel.attributed, 2);
  assert.equal(Math.round(funnel.activationRate * 100), 33);
  assert.equal(Math.round(funnel.returnRate * 100), 33);

  // Signed up but never signed in: the drop-off is named, not hidden.
  assert.equal(funnel.stages[1].lost, 1);
  // 'c' has a record but never signed in, so it is not an activation.
  assert.equal(funnel.stages[2].count, 1);
});

test('channels are ranked by signups, with unattributed last', () => {
  const funnel = summariseFunnel({
    profiles: [
      { id: 'a', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'b', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'c', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'd', lastSignInAt: '2026-11-01T10:00:00Z' },
      { id: 'e', lastSignInAt: '2026-11-01T10:00:00Z' },
    ],
    stats: [
      { id: 'a', customerCount: 1 },
      { id: 'b', customerCount: 1 },
      { id: 'c', customerCount: 1 },
    ],
    acquisition: [
      { userId: 'a', source: 'whatsapp' },
      { userId: 'b', source: 'whatsapp' },
      { userId: 'c', source: 'instagram' },
      { userId: 'd', source: 'whatsapp' },
    ],
  });

  assert.deepEqual(funnel.channels.map((c) => c.source), ['whatsapp', 'instagram', UNATTRIBUTED]);
  const whatsapp = funnel.channels[0];
  assert.equal(whatsapp.signups, 3);
  assert.equal(whatsapp.activated, 2);
  assert.equal(Math.round(whatsapp.activationRate * 100), 67);
});

test('an empty database is a zeroed funnel, not a crash or a division by zero', () => {
  const funnel = summariseFunnel();
  assert.equal(funnel.total, 0);
  assert.equal(funnel.activationRate, null);
  assert.equal(funnel.returnRate, null);
  assert.deepEqual(funnel.channels, []);
  assert.deepEqual(funnel.stages.map((s) => s.count), [0, 0, 0, 0]);
  assert.equal(funnel.stages[0].ofSignups, null);
});
