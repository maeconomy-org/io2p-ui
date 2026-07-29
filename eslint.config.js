import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-plugin-prettier'
import tailwindcss from 'eslint-plugin-tailwindcss'
import next from '@next/eslint-plugin-next'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      prettier,
      tailwindcss,
      '@next/next': next,
    },
    rules: {
      // PRETTIER
      'prettier/prettier': 'error',

      // TYPESCRIPT
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // REACT
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // eslint-plugin-react-hooks v7's `recommended` is no longer just
      // rules-of-hooks + exhaustive-deps: it carries the React Compiler's
      // correctness rules (purity, immutability, refs, set-state-in-effect,
      // preserve-manual-memoization, …). Those are a prerequisite for enabling
      // the compiler, which silently skips any component that breaks them.
      ...reactHooks.configs.recommended.rules,

      // ── Adoption ratchet ───────────────────────────────────────────────
      // Turning the whole set on at once left 72 findings across 40 files. A
      // category sits at 'warn' until it reaches zero, then moves up to 'error'
      // so it can never regress. Promote — never demote — and delete the entry
      // once it is at 'error'.
      //
      // Clean and enforced: rules-of-hooks, purity, globals, static-components,
      // set-state-in-render, error-boundaries, use-memo,
      // preserve-manual-memoization, config, gating.
      'react-hooks/set-state-in-effect': 'warn', // 22 left
      'react-hooks/exhaustive-deps': 'warn', // 15 left
      'react-hooks/refs': 'warn', // 11 left
      'react-hooks/immutability': 'warn', // 7 left
      // Informational, not a defect: flags libraries whose APIs return
      // functions the compiler cannot memoize (react-hook-form, TanStack
      // Table). Nothing to fix on our side — it reports skipped compilation.
      'react-hooks/incompatible-library': 'warn',

      // NEXT.JS
      '@next/next/no-html-link-for-pages': 'error',

      // TAILWINDCSS
      'tailwindcss/no-custom-classname': 'off',

      // GENERAL
      'no-console': 'off', // Allow console for debugging
      'no-debugger': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': 'off', // Use TypeScript version instead
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Configuration files
    files: [
      '**/*.config.{js,ts,mjs}',
      '**/next.config.{js,ts,mjs}',
      '**/eslint.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Node-only ESM scripts (e.g. e2e fixture generators, build helpers)
    // not covered by the .config.* glob above.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Test files
    files: [
      '**/*.test.{js,ts,tsx}',
      '**/*.spec.{js,ts,tsx}',
      '**/__tests__/**/*',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        vi: 'readonly', // Vitest
        test: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      '**/*.d.ts',
      'coverage/**',
      '.turbo/**',
      // Gitignored working directories — scratch scripts and notes, not code we
      // ship. `lint` widened from src/** to the whole repo, which otherwise
      // starts reporting on files git doesn't track.
      'docs/**',
      'internal-docs/**',
    ],
  },
]
