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

**Next.js 15 App Router** with **TypeScript**, **pnpm**, and standalone Docker output.

### Core Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
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

## File Organization

```
src/
├── app/              # Next.js pages and layouts
│   └── <route>/
│       ├── page.tsx      # Route page component
│       ├── loading.tsx   # Route-level skeleton loader
│       ├── layout.tsx    # Route layout (if needed)
│       └── components/   # Route-specific components
├── components/       # Shared components
│   ├── ui/               # shadcn/ui primitives (barrel: index.ts)
│   ├── skeletons/        # Skeleton loaders (barrel: index.ts)
│   ├── navbar/           # Navbar feature (barrel: index.ts)
│   ├── modals/           # Shared modal dialogs
│   ├── tables/           # Table components
│   ├── object-sheets/    # Object detail/add sheets
│   ├── properties/       # Property components + hooks
│   ├── processes/        # Process feature components
│   ├── groups/           # Group feature components
│   └── onboarding/       # Tour/onboarding components
├── constants/        # Static config, nav items, enums (barrel: index.ts)
├── contexts/         # React context providers (barrel: index.ts)
├── hooks/            # Custom hooks (barrel: index.ts)
│   ├── api/              # SDK-wrapping React Query hooks
│   ├── data/             # Complex data transformation hooks
│   ├── import/           # File processing & import hooks
│   ├── process/          # Process business logic hooks
│   └── ui/               # UI state hooks (debounce, pagination, etc.)
├── lib/              # Utilities, SDK client, helpers
├── messages/         # i18n translation files (en.json, nl.json)
├── styles/           # Custom CSS (driver.js overrides, etc.)
└── types/            # Shared TypeScript types
```

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

Only **cross-cutting** utilities used by 3+ unrelated features:

- `utils.ts` — `cn()`, `truncateText()`, `formatNumericValue()`
- `logger.ts` — Logging with Sentry integration
- `sdk-client.ts` — SDK singleton factory
- `error-utils.ts` — Generic error detection
- `auth-fetch.ts` — Authenticated fetch wrapper
- `validations/` — Shared Zod schemas
- Server-only: `api-auth.ts`, `crypto-utils.ts`, `redis.ts`, `redis-utils.ts`, `security-utils.ts`, `import-processor.ts`

If a utility is only used by one feature (e.g., `group-utils.ts` only used by groups), move it to that feature's `utils/` directory and re-export from the feature's `index.ts`.

## Naming Conventions

### Files & Directories — **ALL files use `kebab-case`** (no exceptions)

| Type                 | Convention                              | Example                                         |
| -------------------- | --------------------------------------- | ----------------------------------------------- |
| **Pages**            | `page.tsx` (Next.js)                    | `src/app/objects/page.tsx`                      |
| **Layouts**          | `layout.tsx`                            | `src/app/layout.tsx`                            |
| **Loading states**   | `loading.tsx`                           | `src/app/objects/loading.tsx`                   |
| **Error boundaries** | `error.tsx` / `global-error.tsx`        | `src/app/global-error.tsx`                      |
| **Components**       | `kebab-case.tsx`                        | `object-details-sheet.tsx`, `client-layout.tsx` |
| **Hooks (all)**      | `use-kebab-case.ts`                     | `use-aggregate.ts`, `use-view-data.ts`          |
| **Contexts**         | `kebab-case.tsx` with `-context` suffix | `auth-context.tsx`, `query-context.tsx`         |
| **Constants**        | `kebab-case.ts`                         | `client.ts`, `auth.ts`                          |
| **Types**            | `kebab-case.ts`                         | `sankey-metadata.ts`                            |
| **Utilities**        | `kebab-case.ts`                         | `sdk-client.ts`, `utils.ts`                     |
| **Tests (unit)**     | `<source-file>.test.ts(x)`              | `use-aggregate.test.ts`                         |
| **Tests (E2E)**      | `<feature>.spec.ts`                     | `navigation.spec.ts`                            |
| **Barrel exports**   | `index.ts`                              | Every feature folder must have one              |
| **Directories**      | `kebab-case`                            | `object-sheets/`, `import-status/`              |

> **Rule**: File names are always `kebab-case`. Component/hook _exports_ inside files use PascalCase/camelCase per JS convention. Never name a file `MyComponent.tsx` — use `my-component.tsx`.

### Code Naming

| Type                  | Convention                | Example                                 |
| --------------------- | ------------------------- | --------------------------------------- |
| **React components**  | `PascalCase`              | `ObjectsPageSkeleton`, `NavbarSkeleton` |
| **Hooks**             | `useCamelCase`            | `useViewData`, `useAggregate`           |
| **Context providers** | `PascalCase` + `Provider` | `AuthProvider`, `QueryProvider`         |
| **Context hooks**     | `useCamelCase`            | `useAuth`, `useAppConfig`               |
| **Constants**         | `UPPER_SNAKE_CASE`        | `NAV_ITEMS`, `PUBLIC_PAGES`             |
| **Types/Interfaces**  | `PascalCase`              | `ClientConfig`, `AuthResponse`          |
| **Enums**             | `PascalCase`              | `ProcessViewType`                       |
| **Translation keys**  | `dot.separated.camelCase` | `objects.childrenPage.loadingParent`    |
| **CSS variables**     | `--kebab-case`            | `--primary`, `--muted-foreground`       |
| **Query keys**        | `camelCase` arrays        | `['aggregateEntities', uuid]`           |

## Loading & Skeleton Patterns

- **SDK initialization** (`QueryProvider`): `NavbarSkeleton` + `ContentSkeleton` (or `AppShellSkeleton`).
- **Auth check** (`ProtectedRoute`): `AppShellSkeleton`.
- **Route transitions**: Every route directory has a `loading.tsx` that renders `<ContentSkeleton />` / `<AppShellSkeleton />`.
- Skeleton components live in `src/components/skeletons/` with barrel export.
- **Data fetching (React Query)**: Use inline loading within the page layout — show the page header/filters immediately, only show a spinner in the content area. Never replace the full page with a skeleton during data refetch.
- **DataTable**: Pass `fetching={true}` to the DataTable component — it has built-in loading row display. Do NOT wrap the entire table in a full-page skeleton.
- **Empty states**: Use `<EmptyState />` from `@/components/ui` for empty lists, search results, and filtered views. Always include an `icon`, `title`, and optional `description`.
- **Button mutations**: `Loader2` spinner icon inside the button is acceptable.
- **Pagination**: Use `placeholderData: keepPreviousData` from React Query to keep old data visible during page transitions — no loading flash.
- **Dynamic imports**: Skeleton placeholder matching the component dimensions.
- Never use raw spinners for full-page loading — always use skeleton shimmer.

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

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` — Command center / search
- `t` — Cycle theme (light → dark → system)
- `l` — Toggle language (en ↔ nl)
