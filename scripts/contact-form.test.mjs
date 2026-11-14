import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The public contact form is three files that must agree with each other and
 * with the deployment: a static page, a script holding a hardcoded endpoint and
 * a public key, and a rewrite that decides what URL people actually land on.
 *
 * None of that is visible to the build. A wrong project ref answers 401 and the
 * page shows "we couldn't send that" — a silent, permanent failure of the only
 * collection point for enquiries. A `service_role` key pasted into a file served
 * to the world would be far worse, so both are pinned here rather than trusted.
 */

const ROOT = process.cwd();
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8');

const html = read('public', 'landing', 'pages', 'contact.html');
const script = read('public', 'landing', 'js', 'contact.js');
const vercel = JSON.parse(read('vercel.json'));

const endpoint = script.match(/var ENDPOINT = '([^']+)'/)?.[1];
const anonKey = script.match(/var ANON_KEY = '([^']+)'/)?.[1];

const decodeJwt = (token) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

test('the form posts to the contact function of the project its key belongs to', () => {
  assert.ok(endpoint, 'contact.js must declare an ENDPOINT');
  assert.ok(anonKey, 'contact.js must declare an ANON_KEY');

  const url = new URL(endpoint);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/functions/v1/contact', 'the function is named `contact`');
  assert.match(url.hostname, /^[a-z0-9]+\.supabase\.co$/);

  // The host's project ref and the JWT's `ref` claim must be the same project.
  // Two different Supabase projects is the mistake that reads as "form broken".
  const projectRef = url.hostname.split('.')[0];
  const claims = decodeJwt(anonKey);
  assert.equal(claims.ref, projectRef, 'the anon key belongs to a different project');
});

test('the key in a public file is the anon key and nothing else', () => {
  // scan:dist catches a privileged JWT in the bundle, but this file is also
  // served directly, so the claim is asserted here too.
  const claims = decodeJwt(anonKey);
  assert.equal(claims.role, 'anon', 'a non-anon key must never be shipped to a browser');
  assert.equal(typeof claims.exp, 'number');
});

test('the page carries the fields, the honeypot and the caps the function enforces', () => {
  assert.match(html, /id="contactForm"/);
  assert.match(html, /name="name"[^>]*maxlength="120"[^>]*required/);
  assert.match(html, /name="email"[^>]*maxlength="254"[^>]*required/);
  assert.match(html, /name="message"[^>]*minlength="10"[^>]*maxlength="5000"[^>]*required/);

  // The honeypot is the only client-independent bot check that is free; it has
  // to be in the form the script reads, and out of the tab order.
  assert.match(html, /name="website"/);
  assert.match(html, /name="website"[^>]*tabindex="-1"/);
  assert.match(html, /class="contact-form__hp"/);

  // Every subject the page offers must be one the table's CHECK accepts.
  const subjects = [...html.matchAll(/<option value="([a-z]+)">/g)].map((m) => m[1]);
  assert.deepEqual(subjects, ['general', 'account', 'billing', 'technical', 'privacy', 'data']);
});

test('the page is served at /contact, so its links must be absolute', () => {
  // `/contact` is rewritten to a file in `landing/pages/`, so a relative
  // `privacy.html` would resolve to `/privacy.html` and land on the SPA shell.
  for (const [, href] of html.matchAll(/href="([^"#][^"]*)"/g)) {
    const isAbsolute = /^(https?:|mailto:|\/)/.test(href);
    assert.ok(isAbsolute, `relative link "${href}" breaks on /contact`);
  }

  const rewrite = vercel.rewrites.find((r) => r.source === '/contact');
  assert.ok(rewrite, 'vercel.json must rewrite /contact');
  assert.equal(rewrite.destination, '/landing/pages/contact.html');

  // The canonical URL is what search engines index; it must be the one linked.
  assert.match(html, /rel="canonical" href="https:\/\/www\.kaisysales\.com\/contact"/);
});

test('no landing page routes an enquiry to a mailbox', () => {
  // One collection point was the point of the change, and it now includes the
  // account-deletion path: Terms §11 sends people to the form rather than a
  // mailbox, so that a request cannot be lost in an inbox nobody watches.
  const pages = ['index.html', 'pages/help.html', 'pages/privacy.html', 'pages/pricing.html', 'pages/terms.html'];
  for (const page of pages) {
    const body = read('public', 'landing', page);
    const mailtos = [...body.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(mailtos, [], `${page} must send enquiries to /contact`);
    assert.match(body, /href="\/contact"/, `${page} must link to /contact`);
  }
});

test('deleting a message is admin-only, and never granted to anon', () => {
  // The delete capability exists because a public form collects spam and
  // personal data from people who never signed up. It must not widen what the
  // public key can do: the table's whole protection is that `anon` holds no
  // grant at all.
  const migration = read('supabase', 'migrations', '20261111130000_contact_messages_admin_delete.sql');

  assert.match(migration, /GRANT DELETE ON public\.contact_messages TO authenticated/);
  assert.match(migration, /FOR DELETE TO authenticated\s+USING \(public\.is_admin\(\)\)/);

  // No GRANT of any kind to anon anywhere in the file.
  for (const [, grantee] of migration.matchAll(/GRANT [^;]*? TO ([a-z_]+)/g)) {
    assert.notEqual(grantee, 'anon', 'anon must never be granted anything on contact_messages');
  }
});
