import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Linter } from 'eslint';
import { themeTokensPlugin, RUNTIME_ALIASES } from '../eslint-rules/theme-tokens.js';

const linter = new Linter({ configType: 'flat' });

const config = {
  files: ['**/*.{js,jsx}'],
  plugins: { themeTokens: themeTokensPlugin },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: { 'themeTokens/no-undefined-token': 'error' },
};

function lint(expression) {
  return linter.verify(expression, config, 'probe.jsx');
}

const ruleId = 'themeTokens/no-undefined-token';

test('accepts every shape of reference that actually resolves', () => {
  const valid = [
    'const a = theme.colors.primary;',
    'const b = theme.colors.background.surfaceVariant;',
    'const c = theme.colors.text.main;',
    'const d = themeTokens.shadows.soft;',
    'const e = theme.borderRadius.md;',
    'const f = p => p.theme.colors.outlineVariant;',
    'const g = theme.transitions.fast;',
  ];
  for (const code of valid) {
    assert.deepEqual(lint(code), [], `expected no findings for: ${code}`);
  }
});

test('rejects the token names that actually shipped broken', () => {
  // theme.colors.text.primary shipped to production; the real token is
  // text.main. theme.colors.surfaceVariant was nested under the wrong branch.
  const broken = [
    'const a = theme.colors.text.primary;',
    'const b = theme.colors.text.contrast;',
    'const c = theme.colors.surfaceVariant;',
    'const d = theme.colors.background.cream;',
    'const e = theme.colors.primaryHover;',
    'const f = props => props.theme.colors.error;',
  ];
  for (const code of broken) {
    const messages = lint(code);
    assert.equal(messages.length, 1, `expected exactly one finding for: ${code}`);
    assert.equal(messages[0].ruleId, ruleId);
    assert.match(messages[0].message, /not defined in src\/styles\/themeTokens\.js/);
  }
});

test('reports only the outermost link, once per broken chain', () => {
  const messages = lint('const a = theme.colors.text.primary;');
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /`theme\.colors\.text\.primary`/);
});

test('allows the runtime aliases ThemeContext adds on top of the token object', () => {
  for (const alias of RUNTIME_ALIASES) {
    assert.deepEqual(lint(`const a = theme.${alias};`), [], `expected theme.${alias} to be allowed`);
  }
});

test('the runtime alias list has not drifted from ThemeContext', () => {
  const source = readFileSync(new URL('../src/context/ThemeContext.jsx', import.meta.url), 'utf8');
  const block = source.match(/const theme = \{([\s\S]*?)\n  \};/);
  assert.ok(block, 'could not locate the theme object literal in ThemeContext.jsx');

  const declared = [...block[1].matchAll(/^\s{4}([A-Za-z][\w]*):/gm)].map((m) => m[1]);
  assert.deepEqual(
    declared.sort(),
    [...RUNTIME_ALIASES].sort(),
    'ThemeContext adds a key that RUNTIME_ALIASES in eslint-rules/theme-tokens.js does not list; '
      + 'add it there or the lint rule will flag valid code',
  );
});

test('stays silent on dynamic access it cannot prove wrong', () => {
  const unverifiable = [
    'const a = theme.colors[key];',
    'const b = theme.colors[key].deep;',
    'const c = other.colors.text.primary;',
    'const d = theme.colors.primary;',
  ];
  for (const code of unverifiable) {
    assert.deepEqual(lint(code), [], `expected no findings for: ${code}`);
  }
});
