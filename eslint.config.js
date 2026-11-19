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
    // The entity sheet's field components, which all take `form` as a PROP.
    files: ['src/components/entity-sheet/fields/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // FOUR shipped bugs were this one line, and every one of them was
          // invisible in dev: `form.watch()` registers a subscription that
          // re-renders whoever OWNS the `useForm`, not the component that
          // called it. A reader that receives `form` therefore updates only
          // when something else happens to re-render it — and under the
          // production-only React Compiler, nothing does. Soft-deleting a
          // property did nothing at all in a shipped build while every dev run
          // stayed green.
          //
          // `useWatch({ control: form.control, name })` subscribes the READER.
          selector:
            "MemberExpression[object.name='form'][property.name='watch']",
          message:
            'A component that receives `form` as a prop must use useWatch({ control: form.control, name }) — form.watch() subscribes the form OWNER, so this component will render stale values in a production build.',
        },
      ],
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
    // E2E specs. Deliberately stricter than `src/__tests__` above, which this
    // block overrides by coming after it.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      // Playwright's fixture signature is `async ({ page }, use) => { await use(x) }`. The rule
      // reads that parameter as React 19's `use` hook and reports every fixture.
      'react-hooks/rules-of-hooks': 'off',
      // An unused import is how a deleted helper announces itself. With this
      // off, `mock-file-storage` kept importing a hook that no longer existed
      // and nothing said so for months.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        // Ratchet, per the block above: 30 existing violations, all in specs
        // that §2 already marks PORT or REWRITE. Promote to 'error' once
        // `pnpm run lint` reports zero.
        //
        // 'warn' is what the repo-wide `lint` sees. lint-staged runs
        // `--max-warnings 0`, so a file must be clean to be COMMITTED — which
        // is the ratchet working: legacy files carry a file-level disable
        // naming the reason, and anything touched from here on has to be
        // clean.
        'warn',
        {
          // `if (await x.isVisible())` turns a missing element from a failure
          // into a pass, so the test reports green having asserted nothing —
          // three of the four import specs never ran a single assertion.
          // `expect(x).toBeVisible()` auto-retries AND fails on absence.
          selector:
            'IfStatement > AwaitExpression CallExpression[callee.property.name=/^(isVisible|isHidden|isEnabled|isDisabled|isChecked|isEditable)$/]',
          message:
            'Do not branch on a Playwright state check — the test passes while asserting nothing. Use expect(locator).toBeVisible() etc., which retries and fails on absence. See internal-docs/11-e2e-test-plan.md §2.7.',
        },
        {
          // Same failure, one indirection away.
          selector:
            'VariableDeclarator > AwaitExpression CallExpression[callee.property.name=/^(isVisible|isHidden|isEnabled|isDisabled|isChecked|isEditable)$/]',
          message:
            'Assigning a Playwright state check to a variable is the same silent-pass pattern as branching on it directly. See internal-docs/11-e2e-test-plan.md §2.7.',
        },
      ],
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
