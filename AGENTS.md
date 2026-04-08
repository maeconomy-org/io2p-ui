<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# IoM UI — Agent Guidelines & Codebase Best Practices

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Architecture

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS with CSS variables for theming (`globals.css`)
- **Components**: shadcn/ui — all UI primitives live in `src/components/ui/`
- **State**: React Query (TanStack Query) for server state, React context for client state
- **i18n**: `next-intl` with locale files in `src/messages/{en,nl}.json`
- **Auth**: mTLS client certificate authentication via `src/contexts/auth-context.tsx`
- **SDK**: Custom `@maeconomy/iom-sdk` for all API calls (see `iom-sdk` workspace)

## Rules

### Data Fetching

- **Always use React Query** (`useQuery`, `useMutation`) for API calls — never raw `fetch` or `useEffect` for data loading.
- Custom hooks in `src/hooks/api/` wrap SDK methods with React Query.
- Mutations should invalidate relevant query keys on success.

### Client vs Server Components

- **Minimize `'use client'`** — only add it when the component genuinely needs browser APIs, hooks, or event handlers.
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
- Use `useTranslations()` hook in client components, `getTranslations()` in server components.
- Group keys by feature/page (e.g., `auth.*`, `objects.*`, `nav.*`).

### Components

- Use shadcn/ui components from `@/components/ui` — don't reinvent buttons, dialogs, dropdowns, etc.
- Barrel-export new UI components from `src/components/ui/index.ts`.
- Keep components focused — extract sub-components when a file exceeds ~200 lines.
- Use `lucide-react` for icons.

### Constants

- Store reusable constants in `src/constants/` and export via the barrel `index.ts`.
- Navigation items, feature lists, process types, etc. belong in constants — not inline in components.

### Forms & Validation

- Use controlled components with React state or React Hook Form.
- Validate on the client before submitting; show translated error messages.

### Error Handling

- Wrap async operations in try/catch.
- Use the `logger` from `@/lib` instead of raw `console.log`.
- Show user-friendly translated error messages via `Alert` or `toast`.

### File Organization

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

### Naming Conventions

#### Files & Directories — **ALL files use `kebab-case`** (no exceptions)

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

#### Code Naming

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

#### Skeleton & Loading Patterns

- Single `AppShellSkeleton` used everywhere (navbar skeleton + content boxes)
- Skeleton components live in `src/components/skeletons/` with barrel export
- Every route directory has a `loading.tsx` that renders `<AppShellSkeleton />`
- Never use raw spinners for full-page loading — always use skeleton shimmer

### Loading UX Guidelines

- **SDK initialization** (`QueryProvider`): `AppShellSkeleton`
- **Auth check** (`ProtectedRoute`): `AppShellSkeleton`
- **Route transitions** (`loading.tsx`): `AppShellSkeleton`
- **Data fetching** (React Query): Inline skeletons or shimmer within the page layout
- **Button actions** (mutations): `Loader2` spinner icon inside the button is acceptable
- **Dynamic imports**: Skeleton placeholder matching the component dimensions

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
- `client-layout.tsx` is the layout shell only (navbar, footer, keyboard shortcuts)
- `Toaster` lives inside `Providers`

### Testing

- Unit tests: Vitest (`src/__tests__/`)
- E2E tests: Playwright (`e2e/`)
- Test files mirror the source structure.

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
- **New UI components** (sheets, modals, forms) → Add test cases to the relevant page spec:
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

#### Test Commands

```bash
pnpm test              # Unit tests (watch mode)
pnpm test:run          # Unit tests (single run)
pnpm test:coverage     # Unit tests with coverage
pnpm test:e2e          # E2E tests (requires dev server)
pnpm test:e2e:ui       # E2E tests with Playwright UI
```

#### What Does NOT Need Tests

- Pure UI styling changes (color, spacing, font)
- Translation key additions (unless they change component logic)
- shadcn/ui component files in `src/components/ui/` (third-party primitives)
- Static content pages with no interactivity

### Pre-commit Hooks

- **Husky** runs `lint-staged` on every commit
- **lint-staged** runs: ESLint fix, Prettier format, TypeScript type-check on staged files
- Never bypass with `--no-verify` unless absolutely necessary

### Git Commits

Use conventional commit prefixes:

- `feat:` new feature
- `fix:` bug fix
- `tweak:` minor adjustment
- `refactor:` code restructure
- `style:` formatting only
- `docs:` documentation
- `chore:` maintenance

### Keyboard Shortcuts

- `⌘K` / `Ctrl+K` — Command center / search
- `t` — Cycle theme (light → dark → system)
- `l` — Toggle language (en ↔ nl)

### Common Patterns

```tsx
// ✅ Correct: cn() for conditional classes
<div className={cn('base-class', isActive && 'active-class')} />

// ❌ Wrong: string concatenation
<div className={`base-class ${isActive ? 'active-class' : ''}`} />

// ✅ Correct: translation keys
<p>{t('objects.title')}</p>

// ❌ Wrong: hardcoded text
<p>Objects</p>

// ✅ Correct: React Query for data
const { data } = useQuery({ queryKey: ['objects'], queryFn: fetchObjects })

// ❌ Wrong: useEffect + useState for data
useEffect(() => { fetch('/api/objects').then(...) }, [])
```
