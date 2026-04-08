@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Next.js 15 App Router** with **TypeScript**, **pnpm**, and standalone Docker output.

### Core Stack

- **UI**: Tailwind CSS + Radix UI (shadcn/ui pattern) + Lucide icons
- **Forms**: React Hook Form + Zod validation (`src/lib/validations/`)
- **Data fetching**: TanStack React Query v5 — all API hooks in `src/hooks/api/`
- **Backend SDK**: `iom-sdk` package — single client in `src/lib/sdk-client.ts`
- **Charts**: ECharts via `echarts-for-react`
- **i18n**: `next-intl` — locale files in `src/messages/{en,nl}.json`
- **Error tracking**: Sentry (tunneled through `/api/sentry-tunnel`)

### Key Patterns

**SDK Client** (`src/lib/sdk-client.ts`): Singleton `sdkClient` configured with four service endpoints (auth, registry, node, up). Handles token storage in localStorage, automatic retry (3x), 30s timeout. All API communication goes through this client.

**React Query Hooks** (`src/hooks/api/use-*.ts`): Each domain entity has a dedicated hook (useObjects, useGroups, useProperties, etc.). Cache config: infinite stale time, 10-min GC, no auto-refetch on mount/focus. Mutations must invalidate relevant query keys on success.

**Provider Stack** (`src/components/providers.tsx`):

```
Providers → ThemeProvider → NextIntlClientProvider → QueryProvider → AuthProvider → SearchProvider → children
```

- `layout.tsx` passes server-fetched `messages` to `Providers`
- `client-layout.tsx` is the layout shell (navbar, footer, keyboard shortcuts)
- `Toaster` lives inside `Providers`

**Auth Flow** (`src/contexts/auth-context.tsx`): mTLS certificate or email/password login → JWT stored in localStorage → automatic refresh 5 min before expiry via SDK. Protected routes redirect to `/` (auth page). Public pages defined in `PUBLIC_PAGES_SET`.

**Runtime Config**: Environment variables served to the client via `/api/config` route and inline `<script>` tag in `layout.tsx`. Both use `buildRuntimeConfig()` from `src/constants/client.ts` — the single source of truth. Config is cached in localStorage for 24 hours. This enables a single Docker image across environments.

### Route Structure

- `/(auth)` — Login (certificate + optional email/password)
- `/objects` — Main object list with pagination, filters, bulk actions
- `/objects/[uuid]` — Object detail with tabbed sheets
- `/groups`, `/models`, `/processes` — Entity management views
- `/import`, `/import-status` — Bulk CSV/Excel import workflow
- `/api/*` — Internal API routes (config, import processing, file downloads, address lookup)

## Rules & Conventions

### Data Fetching

- **Always use React Query** (`useQuery`, `useMutation`) — never raw `fetch` or `useEffect` for data loading.
- Custom hooks in `src/hooks/api/` wrap SDK methods with React Query.
- **Always use `queryKeys` factory** from `@/lib/query-keys` for all query key construction — never inline string arrays.
- Mutations must invalidate using the narrowest possible scope (e.g., `queryKeys.objects.detail(uuid)` not `queryKeys.objects.all`).
- Never mutate arrays in query keys — always spread-copy before sorting: `[...uuids].sort()`.

### Client vs Server Components

- **Minimize `'use client'`** — only when the component needs browser APIs, hooks, or event handlers.
- Server components are the default. If a page needs client interactivity, extract the interactive part into a separate client component.

### Styling

- **Always use `cn()` from `@/lib/utils`** for conditional/merged class names — never string concatenation or template literals.
- Use Tailwind utility classes; avoid inline styles.
- Use CSS variables from `globals.css` for theme colors (e.g., `text-primary`, `bg-muted`).
- Support both light and dark mode — use `dark:` variants or CSS variables.

### Translations / i18n

- **Always add translation keys** for user-facing text — never hardcode English strings.
- Add keys to both `src/messages/en.json` and `src/messages/nl.json`.
- Use `useTranslations()` in client components, `getTranslations()` in server components.
- Group keys by feature/page (e.g., `auth.*`, `objects.*`, `nav.*`).

### Components

- Use shadcn/ui components from `@/components/ui` — don't reinvent buttons, dialogs, dropdowns, etc.
- Barrel-export new UI components from `src/components/ui/index.ts`.
- Keep components focused — extract sub-components when a file exceeds ~200 lines.
- Use `lucide-react` for icons.

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

### Constants

- Store reusable constants in `src/constants/` with barrel export via `index.ts`.
- Navigation items, feature lists, process types belong in constants — not inline in components.

### Common Patterns

```tsx
// ✅ cn() for conditional classes
<div className={cn('base-class', isActive && 'active-class')} />

// ❌ string concatenation
<div className={`base-class ${isActive ? 'active-class' : ''}`} />

// ✅ translation keys
<p>{t('objects.title')}</p>

// ❌ hardcoded text
<p>Objects</p>

// ✅ React Query for data
const { data } = useQuery({ queryKey: ['objects'], queryFn: fetchObjects })

// ❌ useEffect + useState for data
useEffect(() => { fetch('/api/objects').then(...) }, [])
```

## Naming Conventions

### Files & Directories — ALL files use `kebab-case`

| Type                  | Convention                              | Example                            |
| --------------------- | --------------------------------------- | ---------------------------------- |
| Components            | `kebab-case.tsx`                        | `object-details-sheet.tsx`         |
| Hooks                 | `use-kebab-case.ts`                     | `use-aggregate.ts`                 |
| Contexts              | `kebab-case.tsx` with `-context` suffix | `auth-context.tsx`                 |
| Constants/Types/Utils | `kebab-case.ts`                         | `sdk-client.ts`                    |
| Unit tests            | `<source-file>.test.ts(x)`              | `use-aggregate.test.ts`            |
| E2E tests             | `<feature>.spec.ts`                     | `navigation.spec.ts`               |
| Barrel exports        | `index.ts`                              | Every feature folder must have one |

### Code Naming

| Type              | Convention                | Example                              |
| ----------------- | ------------------------- | ------------------------------------ |
| React components  | `PascalCase`              | `ObjectsPageSkeleton`                |
| Hooks             | `useCamelCase`            | `useViewData`                        |
| Context providers | `PascalCase` + `Provider` | `AuthProvider`                       |
| Constants         | `UPPER_SNAKE_CASE`        | `NAV_ITEMS`                          |
| Types/Interfaces  | `PascalCase`              | `ClientConfig`                       |
| Translation keys  | `dot.separated.camelCase` | `objects.childrenPage.loadingParent` |
| CSS variables     | `--kebab-case`            | `--primary`                          |
| Query keys        | `camelCase` arrays        | `['aggregateEntities', uuid]`        |

## Loading & Skeleton Patterns

- **Route transitions**: Every route directory has a `loading.tsx` that renders `<ContentSkeleton />`.
- **SDK init / auth checks**: `QueryProvider` shows `NavbarSkeleton` + `ContentSkeleton`.
- Skeleton components live in `src/components/skeletons/` with barrel export.
- **Data fetching (React Query)**: Use inline loading within the page layout — show the page header/filters immediately, only show a spinner in the content area. Never replace the full page with a skeleton during data refetch.
- **DataTable**: Pass `fetching={true}` to the DataTable component — it has built-in loading row display. Do NOT wrap the entire table in a full-page skeleton.
- **Empty states**: Use `<EmptyState />` from `@/components/ui` for empty lists, search results, and filtered views. Always include an `icon`, `title`, and optional `description`.
- **Button mutations**: `Loader2` spinner icon inside the button is acceptable.
- **Pagination**: Use `placeholderData: keepPreviousData` from React Query to keep old data visible during page transitions — no loading flash.

## Testing Requirements

### Unit Tests (Vitest — `src/__tests__/`)

Every new feature, hook, or utility **must** ship with unit tests.

- **Hooks** → `src/__tests__/hooks/<hook-name>.test.ts` — happy path, edge cases, error handling
- **Utilities** → `src/__tests__/lib/<util-name>.test.ts` — all exports with representative inputs
- **Contexts** → `src/__tests__/contexts/<context-name>.test.tsx` — initial state, transitions, errors
- **Bug fixes** → Add a regression test reproducing the bug before the fix
- **Minimum**: Every new file with business logic must have ≥1 test file with ≥3 meaningful test cases

### E2E Tests (Playwright — `e2e/`)

Any UI change affecting user-visible behavior **must** have E2E coverage.

- **New pages** → `e2e/<NN>-<feature>/<feature>.spec.ts` — smoke test, happy path, one negative test
- **New UI components** → Add cases to relevant page spec (open/close, valid/invalid submit, data persistence)
- Add `data-testid` attributes on form buttons, table rows, action buttons, sheet/modal triggers, nav links

### What Does NOT Need Tests

- Pure styling changes, translation key additions, shadcn/ui files in `src/components/ui/`

## Git Commits

Use conventional commit prefixes: `feat:`, `fix:`, `tweak:`, `refactor:`, `style:`, `docs:`, `chore:`

## Code Style

- Path alias: `@/*` maps to `src/*`
- Prettier: no semicolons, single quotes, trailing commas (es5), 80 char width
- ESLint: flat config (v9), TypeScript + React + Tailwind plugins
- Pre-commit: Husky runs lint-staged (ESLint fix + Prettier format + typecheck on staged files)

## Dynamic Imports & Code Splitting

- **Always lazy-load** heavy/optional components with `next/dynamic` or `React.lazy` + `Suspense`:
  - Sheet/modal components opened by user action → `dynamic(() => import(...), { ssr: false })`
  - Chart libraries (ECharts, etc.) → `dynamic(() => import(...), { loading: () => <Skeleton /> })`
  - Large parsing libraries (PapaParse, xlsx) → `const { parse } = await import('papaparse')`
- **Never** eagerly import a component that is only rendered conditionally (e.g., behind a button click, dialog open, or feature flag).
- CSS files specific to a library (e.g., `driver.js/dist/driver.css`) must be imported in the component that uses them, not in `layout.tsx`.

## Environment Variables

When adding a new environment variable:

1. Add the key + default to `buildRuntimeConfig()` in `src/constants/client.ts`
2. Add the field to the `ClientConfig` interface in the same file
3. Add a sensible default to `DEFAULT_CLIENT_CONFIG`
4. The variable is automatically available via:
   - Inline `<script>` tag on first visit (zero network request)
   - `/api/config` API route (background refresh)
   - `getCachedConfig()` on the client
5. Document the variable in this file under the **Required** or **Optional** section below

**Required**:

- `AUTH_API_URL`, `AUTH_REFRESH_API_URL` — Auth service endpoints
- `REGISTRY_API_URL` — Registry service
- `NODE_API_URL` — Node service
- `REDIS_URL`, `REDIS_PASSWORD` — Server-side caching (import jobs, rate limiting)

**Optional**:

- `UP_API_URL` — UP service
- `HERE_API_KEY` — Address/map lookups
- `EMAIL_LOGIN_ENABLED` — Enable email/password auth (default: certificate only)
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ENABLED` — Error tracking
- `APP_NAME`, `APP_DESCRIPTION`, `APP_ACRONYM` — Branding
- `MAX_FILE_SIZE_MB`, `MAX_IMPORT_PAYLOAD_MB`, `MAX_OBJECTS_PER_IMPORT` — Import limits
- `LOG_LEVEL` — Server logging verbosity
- `ENCRYPTION_KEY` — AES-256-GCM key for encrypting JWTs stored in Redis (auto-generated if missing)
- `CONTACT_URL`, `SUPPORT_EMAIL` — Footer/contact info

## DataTable Usage

The `DataTable` component in `src/components/tables/data-table.tsx` is the standard for all tabular data:

```tsx
<DataTable
  columns={columns}
  data={data}
  getRowId={(row) => row.uuid}
  // Server-side pagination
  pagination={paginationProps}
  onPageChange={handlePageChange}
  // Selection (opt-in)
  enableRowSelection
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  // Column resizing (opt-in)
  enableColumnResizing
  // Loading state — shows inline spinner row, NOT full-page skeleton
  fetching={isFetching}
  // Empty state — uses EmptyState component internally
  emptyIcon={<Inbox className="h-10 w-10" />}
  emptyTitle={t('objects.noResults')}
  emptyDescription={t('objects.noResultsDescription')}
/>
```

- Always use server-side pagination with `manualPagination: true` (this is the default).
- Never build custom table markup — extend `DataTable` instead.
- Column toggle via `DataTableColumnToggle` component.

## API Routes & Security

- **All `/api/*` routes** must validate the JWT via `requireAuth(req)` from `@/lib/api-auth`.
- **Client-side calls to `/api/*`** must use `authFetch()` from `@/lib/auth-fetch` — it attaches the JWT from localStorage automatically.
- Never expose JWT tokens in URLs (query params). Use `Authorization: Bearer` header only.
- File downloads use `fetch` + `Blob` + `URL.createObjectURL()` — never `window.open(url?token=...)`.

## File Organization

### Feature Co-location

Feature-specific utilities, hooks, and types live inside the feature folder — not in `src/lib/`:

```
src/components/groups/
├── components/        # UI components
├── hooks/             # Feature-specific hooks (useGroupFilters, useGroupForm)
├── utils/             # Feature-specific utilities (group-utils.ts)
└── index.ts           # Barrel export (components + hooks + utils)
```

### What stays in `src/lib/`

Only **cross-cutting** utilities that are used by 3+ unrelated features:

- `utils.ts` — `cn()`, `truncateText()`, `formatNumericValue()`
- `logger.ts` — Logging with Sentry integration
- `sdk-client.ts` — SDK singleton factory
- `error-utils.ts` — Generic error detection
- `auth-fetch.ts` — Authenticated fetch wrapper
- `validations/` — Shared Zod schemas
- Server-only: `api-auth.ts`, `crypto-utils.ts`, `redis.ts`, `redis-utils.ts`, `security-utils.ts`, `import-processor.ts`

### What goes in feature folders

If a utility is only used by one feature (e.g., `group-utils.ts` only used by groups), move it to that feature's `utils/` directory and re-export from the feature's `index.ts`.

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

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` — Command center / search
- `t` — Cycle theme (light → dark → system)
- `l` — Toggle language (en ↔ nl)
