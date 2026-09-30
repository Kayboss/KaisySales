import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackend, createAssertBackendAvailable, CONFIG_ERROR_MESSAGE } from '../src/services/backendConfig.js';

/**
 * These tests exist because the failure they guard against is silent. If a
 * production build ever loses its Supabase credentials and the localStorage
 * fallback is allowed to run, users sign in successfully, create invoices, and
 * lose everything when they clear their browser. No log, no error, no crash.
 */

const prod = (url, anonKey) => resolveBackend({ url, anonKey, isDev: false });
const dev = (url, anonKey) => resolveBackend({ url, anonKey, isDev: true });
const REAL_URL = 'https://mjrfvwtgoiukpbpdpuvq.supabase.co';
const REAL_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature';

test('a fully configured build runs and never uses the fallback', () => {
  const result = prod(REAL_URL, REAL_KEY);
  assert.equal(result.isConfigured, true);
  assert.equal(result.isMockFallbackEnabled, false, 'the fallback must be off even when configured');
  assert.equal(result.shouldBlockStartup, false);
});

test('a production build with no credentials refuses to start', () => {
  for (const [url, key] of [[undefined, undefined], ['', ''], [REAL_URL, undefined], [undefined, REAL_KEY]]) {
    const result = prod(url, key);
    assert.equal(result.isConfigured, false);
    assert.equal(result.shouldBlockStartup, true, `should block for url=${url} key=${Boolean(key)}`);
  }
});

test('the placeholder URL from .env.example is not treated as configured', () => {
  assert.equal(prod('https://your-project-ref.supabase.co', REAL_KEY).shouldBlockStartup, true);
  assert.equal(prod('your-project-ref', REAL_KEY).shouldBlockStartup, true);
});

test('the localStorage fallback is available in dev so the UI can be built without credentials', () => {
  const result = dev(undefined, undefined);
  assert.equal(result.isConfigured, false);
  assert.equal(result.isMockFallbackEnabled, true);
  assert.equal(result.shouldBlockStartup, false, 'dev must still start so contributors can work offline');
});

test('the data guard throws in production and never throws in dev', () => {
  const blocked = createAssertBackendAvailable(prod(undefined, undefined));
  assert.throws(() => blocked(), (err) => err.code === 'SUPABASE_NOT_CONFIGURED' && /not configured/.test(err.message));

  const working = createAssertBackendAvailable(prod(REAL_URL, REAL_KEY));
  assert.doesNotThrow(() => working());

  const devFallback = createAssertBackendAvailable(dev(undefined, undefined));
  assert.doesNotThrow(() => devFallback(), 'dev keeps the localStorage fallback');
});

test('the thrown error tells the user nothing was saved', () => {
  const blocked = createAssertBackendAvailable(prod(undefined, undefined));
  try {
    blocked();
    assert.fail('should have thrown');
  } catch (err) {
    assert.match(err.message, /Nothing has been saved/);
  }
});

test('the configuration error text is stable (the dist scanner greps for it)', () => {
  assert.match(CONFIG_ERROR_MESSAGE, /Service|configured/);
});
