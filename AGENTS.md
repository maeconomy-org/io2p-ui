<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# IoM UI — Agent Guidelines & Codebase Best Practices

Always use Context7 MCP when you need library/API documentation, code generation, setup or configuration steps — without me having to explicitly ask.

## Development Commands

```bash
pnpm dev              # Start dev server (https://localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint (src/**/*.{ts,tsx,js,jsx})
pnpm format           # Prettier format
pnpm format:check     # Prettier check
pnpm typecheck        # TypeScript type checking (tsc --noEmit)

# Testing
pnpm test             # Vitest in watch mode
pnpm test:run         # Vitest single run
pnpm test:coverage    # Vitest with coverage
pnpm test:e2e         # Playwright e2e tests (requires dev server)
pnpm test:e2e:ui      # Playwright with UI
pnpm test:e2e:headed  # Playwright with browser visible
pnpm test:e2e:debug   # Playwright debug mode

# Run a single test file
pnpm vitest run src/__tests__/lib/search-parser.test.ts
```

## Architecture

**Next.js 16 App Router** with **TypeScript**, **pnpm**, and standalone Docker output.

### Core Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **UI**: Tailwind CSS + Radix UI (shadcn/ui pattern) + Lucide icons — primitives in `src/components/ui/`
- **Styling**: Tailwind CSS with CSS variables for theming (`globals.css`)
- **Forms**: React Hook Form + Zod validation (`src/lib/validations/`)
- **State**: React Query (TanStack Query) v5 for server state, React context for client state — all API hooks in `src/hooks/api/`
- **Backend SDK**: `iom-sdk` package — single client in `src/lib/sdk-client.ts`
- **Charts**: ECharts via `echarts-for-react`
- **i18n**: `next-intl` — locale files in `src/messages/{en,nl}.json`
- **Auth**: mTLS client certificate authentication via `src/contexts/auth-context.tsx`
- **Error tracking**: Sentry (tunneled through `/api/sentry-tunnel`)

### Key Patterns

**SDK Client** (`src/lib/sdk-client.ts`): Singleton `sdkClient` configured with four service endpoints (auth, registry, node, up). Handles token storage in localStorage, automatic retry (3x), 30s timeout. All API communication goes through this client.

**React Query Hooks** (`src/hooks/api/use-*.ts`): Each domain entity has a dedicated hook (useObjects, useGroups, useProperties, etc.). Cache config: infinite stale time, 10-min GC, no auto-refetch on mount/focus. Mutations must invalidate relevant query keys on success.

**Auth Flow** (`src/contexts/auth-context.tsx`): mTLS certificate or email/password login → JWT stored in localStorage → automatic refresh 5 min before expiry via SDK. Protected routes redirect to `/` (auth page). Public pages defined in `PUBLIC_PAGES_SET`.

**Runtime Config**: Environment variables served to the client via `/api/config` route and inline `<script>` tag in `layout.tsx`. Both use `buildRuntimeConfig()` from `src/constants/client.ts` — the single source of truth. Config is cached in localStorage for 24 hours. This enables a single Docker image across environments.

### Route Structure

- `/(auth)` — Login (certificate + optional email/password)
- `/objects` — Main object list with pagination, filters, bulk actions
- `/objects/[uuid]` — Object detail with tabbed sheets
- `/groups`, `/models`, `/processes` — Entity management views
- `/import`, `/import-status` — Bulk CSV/Excel import workflow
- `/api/*` — Internal API routes (config, import processing, file downloads, address lookup)

### Provider Architecture

All client-side providers are consolidated in `src/components/providers.tsx`:

```
Providers (providers.tsx)
  ThemeProvider (next-themes)
    NextIntlClientProvider (i18n)
      QueryProvider (SDK client + config + React Query)
        AuthProvider (auth state)
          SearchProvider (search state)
            children
```

- `layout.tsx` passes server-fetched `messages` to `Providers`
- `client-layout.tsx` is the layout shell (navbar, footer, keyboard shortcuts)
- `Toaster` lives inside `Providers`

## Rules

### Data Fetching

- **Always use React Query** (`useQuery`, `useMutation`) — never raw `fetch` or `useEffect` for data loading.
- Custom hooks in `src/hooks/api/` wrap SDK methods with React Query.
- **Always use `queryKeys` factory** from `@/lib/query-keys` for query key construction — never inline string arrays.
- Mutations must invalidate using the narrowest possible scope (e.g., `queryKeys.objects.detail(uuid)` not `queryKeys.objects.all`).
- Never mutate arrays in query keys — always spread-copy before sorting: `[...uuids].sort()`.

### Client vs Server Components

- **Minimize `'use client'`** — only when the component genuinely needs browser APIs, hooks, or event handlers.
- Server components are the default in App Router. Prefer them for data fetching and static rendering.
- If a page needs client interactivity, extract the interactive part into a separate client component and keep the page as a server component when possible.

### Styling

- **Always use `cn()` from `@/lib/utils`** for conditional/merged class names — never string concatenation or template literals for Tailwind classes.
- Use Tailwind utility classes; avoid inline styles.
- Use CSS variables from `globals.css` for theme colors (e.g., `text-primary`, `bg-muted`).
- Support both light and dark mode — use `dark:` variants or CSS variables that auto-switch.

### Translations / i18n

- **Always add translation keys** for any user-facing text — never hardcode English strings in components.
- Add keys to both `src/messages/en.json` and `src/messages/nl.json`.
- Use `useTranslations()` in client components, `getTranslations()` in server components.
- Group keys by feature/page (e.g., `auth.*`, `objects.*`, `nav.*`).

### Components

- Use shadcn/ui components from `@/components/ui` — don't reinvent buttons, dialogs, dropdowns, etc.
- Barrel-export new UI components from `src/components/ui/index.ts`.
- Keep components focused — extract sub-components when a file exceeds ~200 lines.
- Use `lucide-react` for icons.
- **Always add `type="button"`** to `<Button>` and `<button>` elements inside forms that are NOT the submit button. Without it, buttons default to `type="submit"` and trigger form submission on click.

### Constants

- Store reusable constants in `src/constants/` and export via the barrel `index.ts`.
- Navigation items, feature lists, process types, etc. belong in constants — not inline in components.

### Forms & Validation

- Use controlled components with React state or React Hook Form.
- Validate on the client before submitting; show translated error messages.

### Accessibility (minimum bar)

- Icon-only buttons must have an `aria-label` (a `title` is not enough — screen readers won't announce it reliably).
- Form inputs must have an associated `<Label htmlFor="...">` or, if visually hidden, a `<VisuallyHidden>` label / `aria-label`.
- Don't rely on color alone to convey state — pair red/green with an icon, text, or `aria-*` attribute.
- Custom interactive elements (clickable `<div>`s) need `role`, `tabIndex={0}`, and keyboard handlers — prefer `<Button>` / `<a>` instead.
- Dialogs/sheets must have a `DialogTitle` (use `<VisuallyHidden>` if it's not shown).

### Error Handling

- Wrap async operations in try/catch.
- **Never use `console.log/warn/error`** — always use `logger` from `@/lib` instead.
- Show user-friendly translated error messages via `Alert` or `toast`.
- Every route segment must have an `error.tsx` error boundary — copy from `src/app/error.tsx`.
- Error boundaries catch React render errors and show a retry UI with Sentry integration.

### Logging

- **Local dev**: Console logs everything at `info` level and above, no Sentry.
- **VM/staging**: Set `LOG_LEVEL=debug` env var for full console output. Set `SENTRY_ENABLED=true` for error tracking.
- **Production**: Console only logs when `LOG_LEVEL` is explicitly set. Sentry captures errors and warnings automatically.
- Use `logger.security(event, details)` for auth/security events.
- Use `logger.import(event, details)` for import pipeline events.

### Dynamic Imports & Code Splitting

- **Always lazy-load** heavy/optional components with `next/dynamic` or `React.lazy` + `Suspense`:
  - Sheet/modal components opened by user action → `dynamic(() => import(...), { ssr: false })`
  - Chart libraries (ECharts, etc.) → `dynamic(() => import(...), { loading: () => <Skeleton /> })`
  - Large parsing libraries (PapaParse, xlsx) → `const { parse } = await import('papaparse')`
- **Never** eagerly import a component that is only rendered conditionally (e.g., behind a button click, dialog open, or feature flag).
- CSS files specific to a library (e.g., `driver.js/dist/driver.css`) must be imported in the component that uses them, not in `layout.tsx`.

### API Routes & Security

- **All `/api/*` routes** must validate the JWT via `requireAuth(req)` from `@/lib/api-auth`.
- **Client-side calls to `/api/*`** must use `authFetch()` from `@/lib/auth-fetch` — it attaches the JWT from localStorage automatically.
- Never expose JWT tokens in URLs (query params). Use `Authorization: Bearer` header only.
- File downloads use `fetch` + `Blob` + `URL.createObjectURL()` — never `window.open(url?token=...)`.

## File Organization

```
src/
├── app/         # Next.js routes — each has page.tsx, optional loading.tsx/error.tsx/layout.tsx, and components/ for route-specific UI
├── components/  # Shared components: ui/ (shadcn primitives), skeletons/, navbar/, modals/, tables/, object-sheets/, properties/, processes/, groups/, onboarding/
├── constants/   # Static config, nav items, enums (barrel: index.ts)
├── contexts/    # React context providers (barrel: index.ts)
├── hooks/       # api/ (SDK + React Query), data/, import/, process/, ui/ — barrel per subfolder
├── lib/         # Cross-cutting utilities only (see below)
├── messages/    # i18n translation files (en.json, nl.json)
└── types/       # Shared TypeScript types
```

**Feature co-location**: feature-specific components, hooks, and utils live inside the feature folder (e.g., `src/components/groups/{components,hooks,utils}/`), not in `src/lib/`. Each feature has a barrel `index.ts`.

**`src/lib/` is for cross-cutting utilities used by 3+ unrelated features only**: `utils.ts` (`cn()`, formatters), `logger.ts`, `sdk-client.ts`, `error-utils.ts`, `auth-fetch.ts`, `validations/`, plus server-only helpers (`api-auth.ts`, `crypto-utils.ts`, `redis*.ts`, `security-utils.ts`, `import-processor.ts`). If a util is used by one feature only, move it to that feature's `utils/`.

## Naming Conventions

- **Files & directories**: `kebab-case` everywhere except Next.js-mandated names (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `global-error.tsx`).
- **Hooks**: file is `use-kebab-case.ts`, export is `useCamelCase`. Context files end in `-context.tsx`.
- **Tests**: unit `<source>.test.ts(x)` mirrors source path; e2e `<feature>.spec.ts` under `e2e/`.
- **Code**: standard JS — `PascalCase` for components/types/enums/providers (e.g., `AuthProvider`), `useCamelCase` for hooks, `UPPER_SNAKE_CASE` for module constants.
- **Translation keys**: `dot.separated.camelCase` (e.g., `objects.childrenPage.loadingParent`).
- **Query keys**: `camelCase` arrays via the `queryKeys` factory.
- **CSS variables**: `--kebab-case`.

## Loading States

- **First paint** (SDK init, auth check, route transitions): skeleton shimmer from `src/components/skeletons/`. Every route has a `loading.tsx`. Never use raw spinners for full-page loading.
- **Data refetch**: keep page chrome visible, show spinner only in the content area. Use `placeholderData: keepPreviousData` for paginated React Query so transitions don't flash.
- **DataTable**: pass `fetching={true}` — it has built-in loading rows. Don't wrap the table in a skeleton.
- **Empty results**: `<EmptyState />` from `@/components/ui` with `icon`, `title`, optional `description`.
- **Button mutations**: `Loader2` icon inside the button is fine.

## DataTable

Use `DataTable` from `src/components/tables/data-table.tsx` for all tabular data. Server-side pagination is the default (`manualPagination: true`). Never build custom table markup — extend `DataTable`. Column toggle via `DataTableColumnToggle`. See the component's prop types for the full API.

## Testing

### Test Commands

```bash
pnpm test              # Unit tests (watch mode)
pnpm test:run          # Unit tests (single run)
pnpm test:coverage     # Unit tests with coverage
pnpm test:e2e          # E2E tests (requires dev server)
pnpm test:e2e:ui       # E2E tests with Playwright UI
```

- Unit tests: Vitest (`src/__tests__/`) — files mirror the source structure.
- E2E tests: Playwright (`e2e/`).

### Acceptance Criteria — Every Feature Must Be Tested

#### Unit Tests (Vitest)

Every new feature, hook, or utility **must** ship with unit tests. No PR should be merged without them.

- **New hooks** → Add `src/__tests__/hooks/<hook-name>.test.ts` covering:
  - Happy path (expected inputs → expected outputs)
  - Edge cases (empty inputs, null/undefined, boundary values)
  - Error handling (API failures, invalid data)
  - Loading/pending states where applicable
- **New lib utilities** → Add `src/__tests__/lib/<util-name>.test.ts` covering:
  - All exported functions with representative inputs
  - Edge cases and invalid inputs
- **New context providers** → Add `src/__tests__/contexts/<context-name>.test.tsx` covering:
  - Initial state
  - State transitions (e.g., auth flow, search flow)
  - Error states and recovery
  - Hook usage outside provider (should throw)
- **Bug fixes** → Add a regression test that reproduces the bug before the fix
- **Minimum**: Every new file with business logic must have ≥1 test file with ≥3 meaningful test cases

#### E2E Tests (Playwright)

Any UI change that affects user-visible behavior **must** have corresponding E2E coverage.

- **New pages** → Add `e2e/<NN>-<feature>/<feature>.spec.ts` with:
  - Smoke test (page loads without error)
  - Primary happy path (create/read/update/delete if applicable)
  - At least one negative test (validation, empty state)
- **New UI components** (sheets, modals, forms) → Add cases to the relevant page spec:
  - Open/close behavior
  - Form submission (valid + invalid)
  - Data persistence (submit, reopen, verify)
- **Modified UI flows** → Update existing E2E tests to match new behavior:
  - Changed selectors, button text, or flow steps must be reflected in specs
  - If a test becomes flaky due to a change, fix the test — don't skip it
- **Stable selectors** → Add `data-testid` attributes on:
  - Form submit/cancel buttons
  - Table rows and action buttons
  - Sheet/modal triggers
  - View selectors and filter toggles
  - Navigation links

### What Does NOT Need Tests

- Pure UI styling changes (color, spacing, font)
- Translation key additions (unless they change component logic)
- shadcn/ui component files in `src/components/ui/` (third-party primitives)
- Static content pages with no interactivity

## Environment Variables

To add a new variable: update `buildRuntimeConfig()`, `ClientConfig`, and `DEFAULT_CLIENT_CONFIG` in `src/constants/client.ts`, then document it below. It's automatically served via the inline `<script>` and `/api/config`, cached in localStorage for 24h.

**Required**: `AUTH_API_URL`, `AUTH_REFRESH_API_URL`, `REGISTRY_API_URL`, `NODE_API_URL`, `REDIS_URL`, `REDIS_PASSWORD`.

**Optional**: `UP_API_URL`, `HERE_API_KEY` (address lookups), `EMAIL_LOGIN_ENABLED`, Sentry (`SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_ENABLED`), branding (`APP_NAME`/`APP_DESCRIPTION`/`APP_ACRONYM`), import limits (`MAX_FILE_SIZE_MB`/`MAX_IMPORT_PAYLOAD_MB`/`MAX_OBJECTS_PER_IMPORT`), `LOG_LEVEL`, `ENCRYPTION_KEY` (AES-256-GCM for Redis-stored JWTs, auto-generated if missing), `CONTACT_URL`, `SUPPORT_EMAIL`.

## SDK (`iom-sdk`)

### Key Architecture

- **TokenStorage**: Configurable via `config.tokenStorage` — `'localStorage'` (default), `'sessionStorage'`, `'memory'`
- **Cross-tab sync**: Automatic for `localStorage` strategy — logout in one tab syncs to all tabs
- **Retry**: Configurable via `config.errorHandling.autoRetryNetwork` — exponential/linear backoff, max retries
- **AbortSignal**: All read methods accept `options?: RequestOptions` with `signal` for cancellation

### After SDK Changes

1. Run `npm run build` in `iom-sdk/`
2. Copy built dist to UI's node_modules: `cp -R iom-sdk/dist/* iom-ui/node_modules/.pnpm/iom-sdk@*/node_modules/iom-sdk/dist/`
3. Run `pnpm typecheck` in UI to verify

> If you use Claude Code, the `/sdk-sync` slash command runs all three steps and reports the result. See **Claude Code Workflow** below.

## Code Style

- Path alias: `@/*` maps to `src/*`
- Prettier: no semicolons, single quotes, trailing commas (es5), 80 char width
- ESLint: flat config (v9), TypeScript + React + Tailwind plugins
- Pre-commit: Husky runs lint-staged (ESLint fix + Prettier format + typecheck on staged files)
- Never bypass pre-commit with `--no-verify` unless absolutely necessary

## Git Commits

Use conventional commit prefixes:

- `feat:` new feature
- `fix:` bug fix
- `tweak:` minor adjustment
- `refactor:` code restructure
- `style:` formatting only
- `docs:` documentation
- `chore:` maintenance

## Claude Code Workflow (optional)

`.claude/` is gitignored, so the tooling below is per-machine until shared.

- **`/sdk-sync`** — runs the three-step SDK sync above, stops on first failure.
- **`/api-update [service...] [free text]`** — diffs `iom-sdk/docs/*.swagger.json` against a baseline in `.claude/cache/swagger/`, plans SDK + UI edits, syncs, verifies, refreshes the baseline only on success. Helper: `node .claude/hooks/swagger-diff.mjs {status|diff|snapshot}`.
- **PostToolUse lint hook** (`.claude/hooks/lint-edited.sh`) — runs `eslint --max-warnings 0` on each `src/**` file Claude edits. Mirrors lint-staged but earlier in the loop.
- **Permissions** (`.claude/settings.local.json`) — allow `pnpm run:*` and read-only git, deny destructive/remote ops (`git push:*`, `git reset --hard:*`, `rm -rf:*`, etc.). `git commit/merge/rebase` prompt per use.
- **Pre-commit secret scan** (`.husky/pre-commit`) — runs `gitleaks protect --staged --redact` if installed (`brew install gitleaks`); warns and skips otherwise.
