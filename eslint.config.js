import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Primitive-boundary guardrail. UI primitives live in
      // src/Components/primitives/ and MUST be imported via the @/ alias
      // (`@/Components/primitives/X`), never a relative path. Keeps the
      // boundary discoverable and prevents relative-import drift from
      // re-scattering primitives. Baseline is clean after the 2026-07-05
      // migration. warn (not error) so it guides without blocking the
      // large existing codebase.
      'no-restricted-imports': ['warn', {
        patterns: [
          {
            group: ['**/primitives/*', '!@/**'],
            message:
              'Import primitives via the @/Components/primitives/* alias, not a relative path.',
          },
        ],
      }],
    },
  },
])
