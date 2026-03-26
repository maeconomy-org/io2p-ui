# IoM UI — Analysis Report

Ongoing audit covering security, performance, SDK architecture, UI/UX, and code quality.

---

## Open Items (from original audit)

### SDK-S3: Credentials sent in URL query params (UP service)

**File**: `iom-sdk/src/services/up/up-client.ts:29-37`
**Severity**: High
**Status**: Blocked — requires backend API change

Email/password sent as query parameters: `POST /api/auth/up/login?username={email}&password={password}`. Credentials appear in server logs, browser history, and network monitoring tools.

**Fix**: Move credentials to request body. Requires backend to read from body instead of query params.

---

### P5: N+1 queries in useObjectsByUUIDs

**File**: `src/hooks/api/use-objects.ts:60-69`
**Impact**: Medium
**Status**: Deferred — needs new batch APIs for process page rewrite

Each UUID triggers a separate query. Need SDK batch method or backend support for multi-UUID fetch.

---

## New Findings

### 1. Missing Error Boundaries

**Severity**: High
**Files**: No `error.tsx` at app root or route segments

No `error.tsx` files anywhere in `src/app/`. Unhandled errors crash the entire app with no recovery UI. QueryProvider has a basic inline error state for API connection issues, but nothing catches React render errors.

**Fix**:

- Add `src/app/error.tsx` as a global error boundary
- Add segment-level `error.tsx` for `/objects`, `/groups`, `/models`, `/processes`
- Each should show a user-friendly error message with a retry button

---

### 2. Component Complexity — 5 files over 600 lines

**Severity**: Medium

| File                                                       | Lines | Issue                                             |
| ---------------------------------------------------------- | ----- | ------------------------------------------------- |
| `src/components/groups/components/group-view-sheet.tsx`    | ~827  | 11+ useState, mixed permission/user/form concerns |
| `src/components/processes/sheets/process-create-sheet.tsx` | ~790  | Multiple form steps intertwined                   |
| `src/components/brick-loader.tsx`                          | ~656  | Pure SVG, no React features needed                |
| `src/components/processes/views/network-view.tsx`          | ~613  | Complex graph + state                             |
| `src/components/object-sheets/object-details-sheet.tsx`    | ~592  | Already has hooks but still large                 |

**Fix**:

- `group-view-sheet.tsx`: Extract `usePermissionState` hook + `<PermissionEditor>` sub-component
- `process-create-sheet.tsx`: Split form steps into separate components
- `brick-loader.tsx`: Convert to `React.memo` plain SVG component, move styles to CSS

---

### 3. Test Coverage Gaps — Critical hooks without tests

**Severity**: Medium

| Hook                                     | Lines | Has Tests? |
| ---------------------------------------- | ----- | ---------- |
| `src/hooks/data/use-view-data.ts`        | ~273  | No         |
| `src/hooks/data/use-breadcrumb-trail.ts` | ~125  | No         |
| `src/hooks/api/use-statements.ts`        | ~406  | No         |

These manage complex filtering, pagination, navigation state, and query construction — all critical paths.

**Fix**: Add test files covering happy path, edge cases, and error handling for each.

---

### 4. React Query Cache Key Patterns — Collision risk + array mutation

**Severity**: Medium
**Files**: `src/hooks/api/use-objects.ts`

- `uuids.sort()` in queryKey **mutates the original array** in place — should be `[...uuids].sort()`
- Multiple hooks use shallow key structures that could collide if param shapes differ
- No centralized query key factory

**Fix**:

- Use immutable sort: `[...uuids].sort()`
- Create `src/lib/query-keys.ts` with typed key builders per entity
- Namespace keys properly: `['objects', 'byUUIDs', { uuids: sorted }]`

---

### 5. Query Invalidation — Overly broad cache busting

**Severity**: Medium
**Files**: `src/hooks/api/use-objects.ts`

`useCreateObject.onSuccess` invalidates ALL `['objects']` queries, flushing paginated list caches unnecessarily. Same pattern in other mutation hooks.

**Fix**:

- Use `queryClient.setQueryData` for optimistic updates on the specific entity
- Only invalidate affected list queries, not the entire namespace
- Or use granular keys: `invalidateQueries({ queryKey: ['objects', 'list'] })`

---

### 6. Type Safety — `any` usage in critical paths

**Severity**: Low-Medium

Key offenders:

- `src/contexts/search-context.tsx` — `searchViewResults: any[]`
- `src/app/import/components/column-mapper.tsx` — `sheetData: any[]`
- `src/app/objects/page.tsx` — `(object: any)` in handlers
- `src/app/api/import/chunk/route.ts` — `let body: any = {}`

**Fix**: Replace with proper DTOs from `iom-sdk` types or create local type interfaces.

---

### 7. API Route Duplication — Repeated validation logic

**Severity**: Low
**Files**: `src/app/api/import/route.ts`, `src/app/api/import/chunk/route.ts`

Both routes duplicate JWT extraction, request validation, user UUID extraction, and rate limiting checks.

**Fix**:

- Extract into `src/lib/api-middleware.ts` with reusable handlers
- Create `validateJWT(req)` → `{ userUUID, jwtToken }` and `validateImportRequest(req)`
- Use in both routes to DRY up validation

---

### 8. Inconsistent Error Logging in API Routes

**Severity**: Low
**Files**: `src/app/api/files/download/[uuid]/route.ts`

File download route uses `console.error` instead of the project's `logger.error`. Other routes use `logger` correctly.

**Fix**: Replace all `console.error`/`console.warn` in API routes with `logger.error`/`logger.warn`.

---

### 9. Missing Hook Return Types

**Severity**: Low
**Files**: `src/hooks/api/*.ts`, `src/hooks/data/*.ts`

All nested hook definitions (e.g., `const useAllObjects = (...) => { return useQuery(...) }`) lack explicit return type annotations. Makes refactoring harder and masks type errors.

**Fix**: Add explicit `UseQueryResult<T, Error>` or `UseMutationResult<T, Error>` return types to all hook functions.

---

### 10. No Prefetch Strategy

**Severity**: Low
**Impact**: UX performance

No data prefetching on hover for links that open detail sheets. Object/group details only start loading when the sheet opens.

**Fix**:

- Add `onMouseEnter` prefetch to sheet trigger buttons:
  ```tsx
  const queryClient = useQueryClient()
  <button onMouseEnter={() => queryClient.prefetchQuery({
    queryKey: ['object', uuid],
    queryFn: () => client.node.getObjects({ uuid })
  })}>
  ```

---

## Priority Roadmap

### Phase 1: Quick Wins — COMPLETED

| #   | Item                                                        | Status                                           |
| --- | ----------------------------------------------------------- | ------------------------------------------------ |
| 1   | Add `error.tsx` error boundaries at app root + key segments | Done — root + 6 route segments                   |
| 2   | Fix `uuids.sort()` array mutation in query keys             | Done — `[...uuids].sort()` via query key factory |
| 3   | Replace `console.error`/`console.warn` with `logger`        | Done — jwt-utils, use-object-operations          |

### Phase 2: Code Quality — PARTIALLY COMPLETED

| #   | Item                                                                    | Status                    |
| --- | ----------------------------------------------------------------------- | ------------------------- |
| 4   | Create query key factory (`src/lib/query-keys.ts`)                      | Done — all hooks migrated |
| 5   | Extract API route validation middleware                                 | Open                      |
| 6   | Add tests for `use-view-data`, `use-breadcrumb-trail`, `use-statements` | Open                      |

### Phase 3: Architecture — PARTIALLY COMPLETED

| #   | Item                                                    | Status                                                          |
| --- | ------------------------------------------------------- | --------------------------------------------------------------- |
| 7   | Split `group-view-sheet.tsx` into sub-components + hook | Open                                                            |
| 8   | Split `process-create-sheet.tsx` into step components   | Open                                                            |
| 9   | Replace `any` types with proper DTOs in critical paths  | Done — search-context, objects page, column-mapper, chunk route |
| 10  | Add prefetch strategy for detail sheets                 | Open                                                            |
| 11  | Improve mutation invalidation patterns                  | Done — targeted invalidation via query key factory              |

### Blocked

| #      | Item                                          | Blocker                   |
| ------ | --------------------------------------------- | ------------------------- |
| SDK-S3 | Move UP credentials from query params to body | Backend API change needed |
| P5     | Batch object fetching (N+1)                   | New batch APIs needed     |

---

> Previous audit phases (1-5) completed. See git history for details on: SDK TokenStorage, cross-tab sync, retry interceptor, AbortSignal support, security headers, API auth middleware, Redis encryption, rate limiting, config centralization, EmptyState component, column resizing, lazy imports, optimizePackageImports, and code co-location.
