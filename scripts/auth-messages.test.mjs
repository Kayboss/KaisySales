import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNUP_STATUS,
  describeAuthError,
  describeSignUp,
  retryAfterSeconds,
} from '../src/utils/authMessages.js';

/* The signup form is the first thing a stranger touches, and the two ways it
   failed were both invisible in a way no other gate could see:

   1. A repeat signup for an existing address returns `{ user: null,
      error: null }`. The old handler tested `if (result)`, so the screen showed
      neither success nor failure. The fix is an explicit status, pinned below.
   2. The email throttle's real text is "For security purposes, you can only
      request this after 47 seconds", which the old `/rate limit/i` branch did
      not match, so it reached the user as a raw log line.

   These are wording contracts, so they are tested rather than eyeballed. */

test('the throttle text is turned into a wait the user can act on', () => {
  const { message, retryAfterSeconds: seconds } = describeAuthError(
    new Error('For security purposes, you can only request this after 47 seconds.')
  );
  assert.equal(seconds, 47);
  assert.match(message, /wait 47 seconds/i);
  assert.doesNotMatch(message, /security purposes/i);
});

test('every GoTrue throttle shape is recognised', () => {
  const shapes = [
    'For security purposes, you can only request this after 23 seconds.',
    'Email rate limit exceeded',
    'over_email_send_rate_limit',
    'Too many requests, please try again later.',
  ];
  for (const text of shapes) {
    const { message } = describeAuthError(new Error(text));
    assert.match(message, /too many attempts/i, `not translated: ${text}`);
  }
});

test('a throttle without a number still asks for a wait, not a raw error', () => {
  const { message, retryAfterSeconds: seconds } = describeAuthError(
    new Error('Email rate limit exceeded')
  );
  assert.equal(seconds, null);
  assert.match(message, /wait a minute/i);
});

test('"already registered" does not promise that logging in will work', () => {
  const { message } = describeAuthError(
    new Error('User already registered')
  );
  assert.match(message, /already has an account/i);
  // An account created before confirmations were switched off is still
  // unconfirmed, and signing in to it is refused — so the wording must offer
  // the confirmation link as well as the login.
  assert.match(message, /confirmation link/i);
});

test('an unconfirmed account is told what to do about it', () => {
  const { message } = describeAuthError(new Error('Email not confirmed'));
  assert.match(message, /confirmation link/i);
  assert.match(message, /spam/i);
});

test('unknown errors are passed through rather than swallowed', () => {
  const { message } = describeAuthError(new Error('network is unreachable'));
  assert.equal(message, 'network is unreachable');
});

test('an empty error still says something', () => {
  for (const empty of [null, undefined, '', {}, new Error('')]) {
    const { message } = describeAuthError(empty);
    assert.match(message, /something went wrong/i);
  }
});

test('retryAfterSeconds reads the shapes GoTrue uses, and only those', () => {
  assert.equal(retryAfterSeconds('only request this after 12 seconds'), 12);
  assert.equal(retryAfterSeconds('please retry in 8 secs'), 8);
  assert.equal(retryAfterSeconds('you can request this in 45 seconds'), 45);
  assert.equal(retryAfterSeconds('nothing to see'), null);
  assert.equal(retryAfterSeconds('after 0 seconds'), null);
  // A number sitting in an unrelated message must not be read as a wait.
  assert.equal(retryAfterSeconds('invite 30 members'), null);
});

test('each signup outcome gets its own message and tone', () => {
  const signedIn = describeSignUp({ status: SIGNUP_STATUS.SIGNED_IN }, 'a@b.com');
  assert.equal(signedIn.tone, 'success');
  assert.match(signedIn.message, /you are in/i);

  const confirm = describeSignUp({ status: SIGNUP_STATUS.NEEDS_CONFIRMATION }, 'a@b.com');
  assert.equal(confirm.tone, 'success');
  // The address has to be echoed back: "check your email" with no address is
  // how a typo in the field becomes a mystery.
  assert.match(confirm.message, /a@b\.com/);
  assert.match(confirm.message, /confirmation link/i);

  const taken = describeSignUp({ status: SIGNUP_STATUS.ALREADY_REGISTERED }, 'a@b.com');
  assert.equal(taken.tone, 'error');
  assert.match(taken.message, /already has an account/i);
  assert.match(taken.message, /forgot passphrase/i);
});

test('an unrecognised outcome never claims success', () => {
  for (const bad of [undefined, null, {}, { status: 'whatever' }]) {
    const outcome = describeSignUp(bad, 'a@b.com');
    assert.equal(outcome.tone, 'error');
    assert.match(outcome.message, /log/i);
  }
});

test('the confirmation message falls back to "your inbox" with no address', () => {
  const { message } = describeSignUp({ status: SIGNUP_STATUS.NEEDS_CONFIRMATION }, '');
  assert.match(message, /your inbox/);
});
