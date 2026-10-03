import { themeTokens } from '../src/styles/themeTokens.js';

// Identifiers that hold the token object. Matched anywhere in a member chain so
// that `theme.colors.x` and `props.theme.colors.x` are both covered.
const HOLDERS = ['theme', 'themeTokens'];

// Keys ThemeContext adds at runtime on top of the token object (see
// src/context/ThemeContext.jsx). These are legitimately absent from
// themeTokens.js, so they must be declared here rather than silently skipped.
const RUNTIME_ALIASES = ['mode', 'background', 'surface'];

function resolve(path) {
  let cursor = themeTokens;
  for (const segment of path) {
    if (cursor === null || typeof cursor !== 'object' || !(segment in cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

// Flattens `a.b.c` into ['a','b','c']. Returns null for anything dynamic, since
// a computed key cannot be proven to be a real token.
function staticChain(node) {
  const parts = [];
  let cursor = node;
  while (cursor.type === 'MemberExpression') {
    if (cursor.computed) return null;
    if (cursor.property.type !== 'Identifier') return null;
    parts.unshift(cursor.property.name);
    cursor = cursor.object;
  }
  if (cursor.type !== 'Identifier') return null;
  parts.unshift(cursor.name);
  return parts;
}

export const themeTokensRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow theme token paths that are absent from src/styles/themeTokens.js',
    },
    schema: [],
    messages: {
      undefinedToken:
        '`{{path}}` is not defined in src/styles/themeTokens.js. It resolves to undefined at runtime, so the style is silently dropped.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        // Report only the outermost link, otherwise `a.b.c` would also report `a.b`.
        if (node.parent.type === 'MemberExpression' && node.parent.object === node) return;

        const chain = staticChain(node);
        if (!chain) return;

        // Use the last holder in the chain so `props.theme.colors.x` validates
        // the path after `theme`, not `props`.
        let holder = -1;
        for (let i = chain.length - 1; i >= 0; i -= 1) {
          if (HOLDERS.includes(chain[i])) holder = i;
        }
        if (holder === -1) return;

        const path = chain.slice(holder + 1);
        if (path.length === 0) return;
        if (resolve(path) !== undefined) return;
        if (path.length === 1 && RUNTIME_ALIASES.includes(path[0])) return;

        context.report({
          node,
          messageId: 'undefinedToken',
          data: { path: chain.join('.') },
        });
      },
    };
  },
};

export const themeTokensPlugin = { rules: { 'no-undefined-token': themeTokensRule } };
export { RUNTIME_ALIASES };
