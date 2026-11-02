/**
 * Acquisition and activation.
 *
 * Two questions, and neither can be answered from inside the product:
 *
 *   1. Which channel brings people who actually USE KaisySales, not just people
 *      who sign up? A signup from a WhatsApp group is indistinguishable from one
 *      typed into the URL bar once the tab is closed, so the first touch has to
 *      be written down at signup time — that is `parseAcquisition` and the
 *      remember/read helpers below.
 *
 *   2. Where do people fall out? "Signed up" is not the number that matters; the
 *      number that matters is how many reach a first record and then come back.
 *      `summariseFunnel` counts those stages from the records the app already
 *      has, so the funnel can never contradict the Users tab.
 *
 * Deliberately pure and import-free so it runs in plain Node: the storage
 * argument is injected (not read from `window`), which makes first-touch rules
 * testable instead of a thing you verify by hand in a browser.
 */

/** Where the landing page leaves the touch for the app to pick up. */
export const TOUCH_STORAGE_KEY = 'kaisysales_acquisition';

/** The campaign parameters that mean something to a marketer. */
export const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'];

/** A referrer or campaign is a label, not a document: cap it so a hostile or
 *  broken URL cannot bloat every row. */
const MAX_TEXT = 120;

const clean = (value) => String(value ?? '').trim().slice(0, MAX_TEXT);

/** Host of a URL without `www.`, or '' when it is missing or not a URL. */
export const hostOf = (url) => {
  if (!url) return '';
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
};

/**
 * Reads one touch out of a URL + referrer.
 *
 * Precedence is campaign first, referrer second, `direct` last:
 *   * a UTM tag is what the marketer paid for and beats everything;
 *   * otherwise the referring host (facebook.com, whatsapp) is the channel;
 *   * a navigation from our own pages is not a channel — it is someone already
 *     here, so it counts as direct rather than inventing a `kaisy-sales` source.
 *
 * Every field is trimmed and capped, and a missing one is '' rather than
 * undefined, because these values are written straight into a database row.
 */
export const parseAcquisition = ({ search = '', referrer = '', pathname = '', ownHost = '' } = {}) => {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const read = (key) => clean(params.get(`utm_${key}`));

  const [utmSource, medium, campaign, content, term] = UTM_KEYS.map(read);
  const refHost = hostOf(referrer);
  const self = clean(ownHost).replace(/^www\./i, '').toLowerCase();

  // `referrer` is kept as given (capped): the host is enough to group by, but the
  // full URL is what tells you WHICH post or group it came from.
  return {
    source: utmSource || (refHost && refHost !== self ? refHost : 'direct'),
    medium,
    campaign,
    content,
    term,
    referrer: clean(referrer),
    landingPage: clean(pathname) || '/',
  };
};

/** The touch as it is stored, or null when storage is unavailable or empty. */
export const readTouch = (storage) => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(TOUCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = clean(parsed.source);
    if (!source) return null;
    return {
      source,
      medium: clean(parsed.medium),
      campaign: clean(parsed.campaign),
      content: clean(parsed.content),
      term: clean(parsed.term),
      referrer: clean(parsed.referrer),
      landingPage: clean(parsed.landingPage) || '/',
      capturedAt: clean(parsed.capturedAt),
    };
  } catch {
    return null;
  }
};

/**
 * Records the first touch of this browser session, once.
 *
 * First touch wins inside a session: someone who arrives from a Facebook group
 * and then navigates to the app is still a Facebook signup, so a later call
 * must not overwrite the first. (Across sessions the touch is gone with the tab,
 * which is the honest answer: a returning visitor typing the URL is direct.)
 *
 * Never throws — private-mode Safari makes `sessionStorage` throw on write, and
 * losing attribution is not a reason to break the page.
 */
export const rememberTouch = (storage, { href = '', referrer = '', ownHost = '' } = {}) => {
  const existing = readTouch(storage);
  if (existing) return existing;
  if (!storage) return null;

  let url;
  try {
    url = new URL(String(href));
  } catch {
    return null;
  }

  const touch = {
    ...parseAcquisition({
      search: url.search,
      referrer,
      pathname: url.pathname,
      ownHost,
    }),
    capturedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(TOUCH_STORAGE_KEY, JSON.stringify(touch));
  } catch {
    return touch;
  }
  return touch;
};

/** Forgets the touch. Used after a flush that could never be retried. */
export const clearTouch = (storage) => {
  if (!storage) return;
  try {
    storage.removeItem(TOUCH_STORAGE_KEY);
  } catch {
    /* nothing to do: a storage that cannot be written cannot be cleared either */
  }
};

/** The record counts that mean "this account has used the product". */
const RECORD_COUNTS = [
  'salesCount',
  'invoiceCount',
  'expenseCount',
  'inventoryCount',
  'customerCount',
  'serviceIncomeCount',
  'recurringIncomeCount',
];

/**
 * True when the account has at least one record of any kind.
 *
 * Counts, not totals: a zero-amount expense is still a record someone took the
 * trouble to enter, and asking "is the total above zero" would call that account
 * dormant.
 */
export const hasRecorded = (stats = {}) =>
  RECORD_COUNTS.reduce((sum, key) => sum + (Number(stats[key]) || 0), 0) > 0;

/**
 * Distinct calendar days per user, from page visits.
 *
 * `page_visits` writes one row per route change, so a single session produces
 * many rows. "Came back" means a SECOND DAY, not a second page view: counting
 * rows would report a returning user on their first afternoon.
 */
export const distinctVisitDays = (visits = []) => {
  const days = new Map();
  for (const visit of visits) {
    const userId = visit.userId || visit.user_id;
    const at = visit.createdAt || visit.created_at;
    if (!userId || !at) continue;
    const day = String(at).slice(0, 10);
    if (!day) continue;
    if (!days.has(userId)) days.set(userId, new Set());
    days.get(userId).add(day);
  }
  return days;
};

const rate = (part, whole) => (whole > 0 ? part / whole : null);

/** Where a signup came from when no row was written (accounts from before this
 *  existed, or a browser that refused storage). Its own bucket, never a guess. */
export const UNATTRIBUTED = 'unattributed';

/**
 * The funnel, from the same sources the admin screens already read.
 *
 * Every stage is a property of a person, so a stage can never count more people
 * than the one before it: signup is all profiles, signed in is a subset, first
 * record a subset of that, and "came back" a subset again. A stage in a funnel
 * that can exceed the previous one is not a funnel, it is four unrelated
 * counters — which is what this replaces.
 *
 * `rate` is null rather than 0 when the denominator is empty, so "no one has
 * signed up yet" renders as "—" instead of a damning 0%.
 */
export const summariseFunnel = ({ profiles = [], acquisition = [], stats = [], visits = [] } = {}) => {
  const statsByUser = new Map(stats.map((s) => [s.id, s]));
  const channelByUser = new Map(acquisition.map((a) => [a.userId || a.user_id, a.source || 'direct']));
  const visitDays = distinctVisitDays(visits);

  const people = profiles.map((profile) => ({
    id: profile.id,
    source: channelByUser.get(profile.id) || UNATTRIBUTED,
    signedIn: Boolean(profile.lastSignInAt || profile.last_sign_in_at),
    activated: hasRecorded(statsByUser.get(profile.id) || {}),
    returned: (visitDays.get(profile.id)?.size || 0) > 1,
  }));

  const total = people.length;
  const signedIn = people.filter((p) => p.signedIn).length;
  const activated = people.filter((p) => p.signedIn && p.activated).length;
  const returned = people.filter((p) => p.activated && p.returned).length;

  const counts = [
    { key: 'signup', label: 'Signed up', count: total },
    { key: 'signin', label: 'Signed in', count: signedIn },
    { key: 'activated', label: 'First record', count: activated },
    { key: 'returned', label: 'Came back', count: returned },
  ];

  const stages = counts.map((stage, index) => {
    const previous = index === 0 ? null : counts[index - 1].count;
    return {
      ...stage,
      ofSignups: rate(stage.count, total),
      ofPrevious: rate(stage.count, previous),
      lost: previous === null ? 0 : previous - stage.count,
    };
  });

  const bySource = new Map();
  for (const person of people) {
    if (!bySource.has(person.source)) {
      bySource.set(person.source, { source: person.source, signups: 0, activated: 0, returned: 0 });
    }
    const row = bySource.get(person.source);
    row.signups += 1;
    if (person.signedIn && person.activated) row.activated += 1;
    if (person.activated && person.returned) row.returned += 1;
  }

  const channels = [...bySource.values()]
    .map((row) => ({
      ...row,
      activationRate: rate(row.activated, row.signups),
      returnRate: rate(row.returned, row.signups),
    }))
    .sort((a, b) => {
      // The biggest channel first; `unattributed` last, because it is the
      // absence of an answer and should never look like the best one.
      if (a.source === UNATTRIBUTED) return 1;
      if (b.source === UNATTRIBUTED) return -1;
      return b.signups - a.signups || a.source.localeCompare(b.source);
    });

  return {
    total,
    signedIn,
    activated,
    returned,
    activationRate: rate(activated, total),
    returnRate: rate(returned, total),
    stages,
    channels,
    attributed: total - (bySource.get(UNATTRIBUTED)?.signups || 0),
  };
};
