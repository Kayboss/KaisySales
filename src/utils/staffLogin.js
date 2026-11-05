/**
 * Rules for creating a staff login.
 *
 * Pure and dependency-free so they can be unit tested, and so the owner sees
 * the same reason the server would give instead of a round-trip that fails
 * with "password is too weak". The edge function
 * (`supabase/functions/create-staff/index.ts`) carries its own copy of these
 * checks because a deployed function cannot import from `src/` — if you change
 * the policy, change it in both places or the client will accept a password the
 * function refuses.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_HINT =
  'At least 8 characters, with a lowercase letter, an uppercase letter and a digit.';

export const isEmail = (value) => EMAIL_PATTERN.test(String(value ?? '').trim());

/** Returns a human-readable problem, or null when the password is acceptable. */
export const passwordProblem = (password) => {
  const value = String(password ?? '');
  if (value.length < 8) return 'The password must be at least 8 characters.';
  if (!/[a-z]/.test(value)) return 'The password must contain a lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'The password must contain an uppercase letter.';
  if (!/[0-9]/.test(value)) return 'The password must contain a digit.';
  return null;
};

// No I, O, 0 or 1: this password is read off a screen and typed by hand, and
// those characters are the ones people get wrong.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

/**
 * A temporary password that satisfies the policy above by construction. The
 * generator is injected so the test can pin the output.
 */
export const generateTemporaryPassword = (random = Math.random, length = 12) => {
  const pick = (alphabet) => {
    const index = Math.min(alphabet.length - 1, Math.floor(random() * alphabet.length));
    return alphabet[Math.max(0, index)];
  };

  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < Math.max(3, length)) chars.push(pick(ALL));

  // Required characters must not always sit in the first three positions, or
  // the password reads like a pattern.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};
