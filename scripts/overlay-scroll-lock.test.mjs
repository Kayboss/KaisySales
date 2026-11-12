import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An overlay that locks `document.body` scroll must unlock it when it closes,
 * and must not lock it while it is merely *rendered*.
 *
 * The incident this pins: `ConfirmDialog` returned `null` when `isOpen` was
 * false, but its `useEffect` had `[]` deps and ran on mount regardless — so
 * rendering the dialog locked the body even when nothing was open, and the
 * cleanup only ran on unmount. Most callers render it conditionally, so it
 * unmounted and the cleanup fired. `AdminInbox` renders it permanently with
 * `isOpen` derived from state, and `AdminDashboard` keeps every visited tab
 * mounted, so the body stayed locked for the rest of the session. The admin
 * panel is rendered OUTSIDE `App`'s `Layout` (which has the only inner
 * `overflow-y: auto` container), so the document is its scroll container:
 * every admin page stopped scrolling from the first visit to the Inbox until a
 * full reload.
 *
 * `Modal` had the same shape with a smaller blast radius (`'unset'` instead of
 * restoring the previous value, which also unlocks an overlay stacked above
 * it). Both now follow the same rule, and this test is what keeps them.
 */

const read = (...parts) => readFileSync(join(process.cwd(), 'src', 'components', 'ui', ...parts), 'utf8');

const effectOf = (source, file) => {
  const match = source.match(/useEffect\(\(\) => \{([\s\S]*?)\},\s*\[([^\]]*)\]\)/);
  assert.ok(match, `${file} must have the scroll-lock effect`);
  return { body: match[1], deps: match[2].trim() };
};

for (const file of ['ConfirmDialog.jsx', 'Modal.jsx']) {
  test(`${file} locks the body only while it is open`, () => {
    const { body, deps } = effectOf(read(file), file);

    assert.equal(deps, 'isOpen', `${file} must re-run when isOpen changes, not only on mount`);
    assert.match(
      body,
      /if \(!isOpen\) return undefined;/,
      `${file} must return before touching document.body when closed`,
    );
  });

  test(`${file} restores the previous overflow instead of a bare reset`, () => {
    const source = read(file);
    const { body } = effectOf(source, file);

    assert.match(body, /const previous = document\.body\.style\.overflow;/);
    assert.match(body, /document\.body\.style\.overflow = previous;/);
    assert.doesNotMatch(
      source,
      /document\.body\.style\.overflow = 'unset'/,
      "'unset' discards an overlay's lock underneath: restore the saved value",
    );
  });
}

test('the one permanently-mounted caller derives isOpen from state', () => {
  // AdminInbox must keep passing a real `isOpen` rather than rendering the
  // dialog only when open — it is the arrangement the gate above makes safe,
  // and the reason the regression was invisible in the other 19 callers.
  const inbox = readFileSync(join(process.cwd(), 'src', 'features', 'admin', 'AdminInbox.jsx'), 'utf8');
  assert.match(inbox, /<ConfirmDialog\s+isOpen=\{Boolean\(pendingDelete\)\}/);
});
