import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import { themeTokensPlugin } from './eslint-rules/theme-tokens.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { themeTokens: themeTokensPlugin },
    rules: {
      // A token that does not exist resolves to undefined, so the declaration is
      // silently dropped and the component renders unstyled. No other gate can
      // see this, which is how theme.colors.primaryHover shipped to production.
      'themeTokens/no-undefined-token': 'error',
    },
  },
])
