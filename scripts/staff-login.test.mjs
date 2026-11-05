import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PASSWORD_HINT,
  isEmail,
  passwordProblem,
  generateTemporaryPassword,
} from '../src/utils/staffLogin.js';

/**
 * Owner-created staff logins are handed over as a temporary password, so the
 * generator must satisfy the same policy the server enforces — a generated
 * password that the function rejects is a dead button.
 */

const EDGE_FUNCTION = join(process.cwd(), 'supabase', 'functions', 'create-staff', 'index.ts');
const edgeSource = readFileSync(EDGE_FUNCTION, 'utf8');

test('generated passwords satisfy the policy they are checked against', () => {
  for (let i = 0; i < 50; i += 1) {
    const password = generateTemporaryPassword();
    assert.equal(password.length, 12);
    assert.equal(passwordProblem(password), null, `rejected: ${password}`);
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[0-9]/);
  }
});

test('the generator avoids characters that are misread when typed by hand', () => {
  const password = generateTemporaryPassword();
  assert.doesNotMatch(password, /[IO01l]/);
});

test('the generator honours an injected random source', () => {
  assert.equal(generateTemporaryPassword(() => 0), 'a2AAAAAAAAAA');
  assert.equal(generateTemporaryPassword(() => 0, 6), 'a2AAAA');
});

test('email validation rejects the shapes the form will actually see', () => {
  assert.equal(isEmail('cashier@example.com'), true);
  assert.equal(isEmail('  boss@shop.gh  '), true);
  assert.equal(isEmail(''), false);
  assert.equal(isEmail('no-at-sign'), false);
  assert.equal(isEmail('no@domain'), false);
  assert.equal(isEmail(null), false);
});

test('password problems name the missing rule', () => {
  assert.match(passwordProblem('Sh0rt'), /at least 8/);
  assert.match(passwordProblem('alllowercase1'), /uppercase/);
  assert.match(passwordProblem('ALLUPPERCASE1'), /lowercase/);
  assert.match(passwordProblem('NoDigitsHere'), /digit/);
  assert.equal(passwordProblem('GoodPass123'), null);
  assert.equal(passwordProblem(''), 'The password must be at least 8 characters.');
  assert.match(PASSWORD_HINT, /lowercase/);
});

test('the edge function enforces the same policy as the client', () => {
  // The deployed function cannot import from src/, so the rules exist twice.
  // This fails the moment one of them is changed alone.
  assert.match(edgeSource, /password\.length < 8/, 'length rule missing from create-staff');
  assert.match(edgeSource, /\/\[a-z\]\//, 'lowercase rule missing from create-staff');
  assert.match(edgeSource, /\/\[A-Z\]\//, 'uppercase rule missing from create-staff');
  assert.match(edgeSource, /\/\[0-9\]\//, 'digit rule missing from create-staff');
  assert.match(edgeSource, /must_change_password: true/, 'first-login password change missing');
});
