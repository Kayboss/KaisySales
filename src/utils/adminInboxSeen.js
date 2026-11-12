/**
 * "Only what's new" bookkeeping for the admin Inbox badge.
 *
 * The badge used to be `open reports + users with errors + never signed in`.
 * Two of those three are *state*, not events: nobody's `last_sign_in_at`
 * changes because the admin looked at the list, and `error_logs` rows are never
 * deleted. The badge therefore read "19" forever, and clearing it was impossible
 * no matter what the admin did — which is the bug this replaces.
 *
 * Now the badge counts what appeared since the admin last loaded the Inbox.
 * Reading the inbox (leaving the tab) drops it to zero, and only a genuinely
 * new signup or a new error brings it back. The full lists inside the inbox are
 * unchanged: they still show every open report, every error user, every account
 * that has never signed in.
 *
 * The stamp lives in localStorage. That is deliberate: it is UI state about
 * *when this admin last looked*, not a business record — every record still
 * comes from Supabase, and a per-browser stamp is the right granularity for a
 * badge only one login can see. A storage failure degrades to "counts
 * everything", i.e. the old behaviour, never to a badge that hides new items.
 */

export const INBOX_SEEN_STORAGE_KEY = 'kaisysales_admin_inbox_seen';

export const inboxSeenKey = (uid) => `${INBOX_SEEN_STORAGE_KEY}:${uid || 'anonymous'}`;

/** PostgREST hands back `…+00:00`, `Date.toISOString()` hands back `…Z`. Same
 *  instant, different spelling, so every comparison parses rather than
 *  comparing strings — `+00:00` sorts after `Z` and would invert the answer. */
const toEpoch = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
};

const toIso = (value) => {
  const epoch = toEpoch(value);
  return Number.isNaN(epoch) ? null : new Date(epoch).toISOString();
};

/** ISO stamp of the last Inbox load, or null the first time (and on any
 *  storage/parse failure, so a corrupt stamp shows the backlog once rather than
 *  hiding it for ever). */
export const readLastSeen = (storage, uid) => {
  if (!storage) return null;
  try {
    return toIso(storage.getItem(inboxSeenKey(uid)));
  } catch {
    return null;
  }
};

export const writeLastSeen = (storage, uid, at = new Date()) => {
  if (!storage) return false;
  const iso = toIso(at);
  if (!iso) return false;
  try {
    storage.setItem(inboxSeenKey(uid), iso);
    return true;
  } catch {
    // Private mode / quota: the badge falls back to counting everything.
    return false;
  }
};

/**
 * True when a row is newer than the stamp.
 *
 * - no stamp yet → everything is new (the first visit after this ships shows
 *   the whole backlog once, then clears, which is also how the fix proves
 *   itself);
 * - an unparseable row timestamp is *not* new once a stamp exists — a row that
 *   cannot be placed in time must not pin the badge on for ever;
 * - an unparseable stamp behaves like no stamp, and the next write replaces it.
 */
export const isNewerThan = (iso, lastSeenAt) => {
  if (!lastSeenAt) return true;
  // Order matters: a corrupt stamp is checked before the row, so it behaves
  // like no stamp at all (count once, then the next write replaces it) even
  // for a row whose own timestamp is unreadable.
  const since = toEpoch(lastSeenAt);
  if (Number.isNaN(since)) return true;
  const row = toEpoch(iso);
  if (Number.isNaN(row)) return false;
  return row > since;
};

/**
 * Counts the four inbox feeds the badge is built from.
 *
 * `errors` are grouped per user, as the list is, so ten errors from one account
 * are one thing to look at — but only if at least one of them is new.
 *
 * Reports are counted by recency like everything else: a report the admin has
 * already been shown must not re-badge for ever just because the thread was
 * never opened. It stays visible under "Open support reports" either way.
 *
 * Contact-form messages have no account behind them, so each one is its own
 * event and is counted individually.
 */
export const summariseUnseen = ({
  reports = [],
  errors = [],
  neverSignedIn = [],
  contactMessages = [],
  lastSeenAt = null,
} = {}) => {
  // Destructuring defaults only cover `undefined`; a caller passing an explicit
  // `null` (a failed fetch, an empty page) must not throw in the badge.
  const rows = (value) => (Array.isArray(value) ? value : []);

  const errorUsers = new Set();
  for (const row of rows(errors)) {
    if (row?.userId && isNewerThan(row.createdAt, lastSeenAt)) errorUsers.add(row.userId);
  }

  const unseen = {
    reports: rows(reports).filter((row) => isNewerThan(row?.createdAt, lastSeenAt)).length,
    errorUsers: errorUsers.size,
    neverSignedIn: rows(neverSignedIn).filter((row) => isNewerThan(row?.createdAt, lastSeenAt)).length,
    contactMessages: rows(contactMessages).filter((row) => isNewerThan(row?.createdAt, lastSeenAt)).length,
  };

  return {
    ...unseen,
    total: unseen.reports + unseen.errorUsers + unseen.neverSignedIn + unseen.contactMessages,
  };
};

/** The browser's localStorage, or null where it does not exist (SSR, tests). */
export const inboxStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
