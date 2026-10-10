// A short-lived, single-flight cache for the heavyweight admin reads.
//
// The admin dashboard mounts several tabs that all want the same few expensive
// feeds — every profile, and every profile joined against eight record tables
// (`fetchUsersWithStats`). Without this, switching tabs re-pays for the same
// scans, and a single tab's `Promise.all` fires the same request more than once.
//
// `cached` resolves a hit for `ttl` ms, and collapses concurrent misses for the
// same key into one in-flight promise, so N simultaneous callers cause one
// request, not N. Failures are never cached: a rejected fetch leaves the key
// empty so the next caller retries.
//
// `invalidateAdminCache` drops everything except the admin-verification entry
// (keys prefixed `admin:verify:`) — that one is keyed by access token and must
// survive a write so a data refresh does not re-verify the caller.
//
// Import-free so it unit-tests in plain Node.

const DEFAULT_TTL_MS = 60 * 1000;
const VERIFY_PREFIX = 'admin:verify:';

const store = new Map();
const inflight = new Map();

export const cached = (key, fetcher, ttl = DEFAULT_TTL_MS) => {
  const entry = store.get(key);
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value);

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttl });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
};

export const invalidateAdminCache = () => {
  for (const key of [...store.keys()]) {
    if (!key.startsWith(VERIFY_PREFIX)) store.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (!key.startsWith(VERIFY_PREFIX)) inflight.delete(key);
  }
};
