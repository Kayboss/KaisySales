/**
 * Auth wording, kept pure so it is testable.
 *
 * Two strings from GoTrue were reaching users verbatim, and both read like
 * defects rather than instructions:
 *
 *   "For security purposes, you can only request this after 47 seconds."
 *     — the reply to a second click on Create, which is exactly what someone
 *       does when the first click appeared to do nothing.
 *
 *   (no string at all)
 *     — a repeat signup for an address that already has an account comes back
 *       as `{ user: null, error: null }`. Any handler waiting for a truthy
 *       result therefore silently does nothing, which is the same experience as
 *       a dead button.
 *
 * Nothing here touches the network; `supabase.js` maps the response, this maps
 * the words.
 */

/** "…after 47 seconds" / "…in 23 secs" -> 47 / 23. */
const WAIT_RE = /(?:after|in)\s+(\d+)\s*(?:seconds?|secs?|s)\b/i;

/** Every shape GoTrue uses for its email/OTP send throttle. */
const RATE_RE = /security purposes|rate limit|too many requests|only request this after|over_email_send_rate_limit/i;

export const SIGNUP_STATUS = {
  SIGNED_IN: 'signed_in',
  NEEDS_CONFIRMATION: 'needs_confirmation',
  ALREADY_REGISTERED: 'already_registered',
};

/**
 * How long the server wants the user to wait, in seconds, or null.
 * @param {string} message
 * @returns {number|null}
 */
export function retryAfterSeconds(message) {
  const match = WAIT_RE.exec(String(message || ''));
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * @param {{ message?: string, error_description?: string, msg?: string }|Error|string} err
 * @returns {{ message: string, retryAfterSeconds: number|null }}
 */
export function describeAuthError(err) {
  const raw =
    typeof err === 'string'
      ? err
      : err?.message || err?.error_description || err?.msg || '';

  if (!raw) {
    return {
      message: 'Something went wrong. Please try again.',
      retryAfterSeconds: null,
    };
  }

  if (RATE_RE.test(raw)) {
    const seconds = retryAfterSeconds(raw);
    return {
      message: seconds
        ? `Too many attempts. Please wait ${seconds} seconds, then try again.`
        : 'Too many attempts. Please wait a minute, then try again.',
      retryAfterSeconds: seconds,
    };
  }

  if (/already registered|already exists|email already in use|user already registered/i.test(raw)) {
    return {
      // Deliberately does not promise that logging in will work: an account that
      // was created before email confirmation was switched off is still
      // unconfirmed, and logging in to it is refused.
      message:
        'This email already has an account. Log in instead — or use "Forgot passphrase". ' +
        'If you signed up but never confirmed, the confirmation link is in that inbox.',
      retryAfterSeconds: null,
    };
  }

  if (/email not confirmed|not confirmed/i.test(raw)) {
    return {
      message:
        'This account is not confirmed yet. Open the confirmation link we emailed you, then log in. ' +
        'If it never arrived, look in spam or contact support.',
      retryAfterSeconds: null,
    };
  }

  if (/invalid login credentials|wrong password|invalid-credential|user not found/i.test(raw)) {
    return {
      message: 'Invalid business email or secret passphrase. Please review your entries.',
      retryAfterSeconds: null,
    };
  }

  if (/invalid email|email address is invalid/i.test(raw)) {
    return {
      message: 'Please enter a valid business email address.',
      retryAfterSeconds: null,
    };
  }

  if (/weak password|password is too weak|password should be/i.test(raw)) {
    return {
      message: 'The passphrase is too weak. Please use a stronger combination.',
      retryAfterSeconds: null,
    };
  }

  if (/signups? not allowed|signup is disabled|disable_signup/i.test(raw)) {
    return {
      message: 'New accounts are closed at the moment. Please contact support.',
      retryAfterSeconds: null,
    };
  }

  return { message: raw, retryAfterSeconds: null };
}

/**
 * What to show after a signup attempt.
 *
 * @param {{ status: string, email?: string }} result
 * @param {string} email
 * @returns {{ tone: 'success'|'error', message: string }}
 */
export function describeSignUp(result, email) {
  const status = result?.status;
  const address = email || result?.email || 'your inbox';

  if (status === SIGNUP_STATUS.ALREADY_REGISTERED) {
    return {
      tone: 'error',
      message:
        'This email already has an account, so nothing new was created. ' +
        'Log in instead — or use "Forgot passphrase". If you signed up but never confirmed, ' +
        'the confirmation link is in that inbox.',
    };
  }

  if (status === SIGNUP_STATUS.NEEDS_CONFIRMATION) {
    return {
      tone: 'success',
      message:
        `Account created. We sent a confirmation link to ${address} — open it, then log in. ` +
        'If it is not there in a few minutes, check the spam folder.',
    };
  }

  if (status === SIGNUP_STATUS.SIGNED_IN) {
    return {
      tone: 'success',
      message: 'Account created — you are in.',
    };
  }

  // Unknown status: never claim success we cannot see.
  return {
    tone: 'error',
    message: 'We could not confirm the account was created. Please try logging in.',
  };
}
