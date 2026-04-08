# Plan: Cross-User Group Sharing E2E Tests

## Context

The groups e2e suite (files 01-04) covers smoke tests, CRUD, user management, and object assignment — but always from a single user's perspective. We need to verify that sharing a group with another user actually works end-to-end: the shared user can see the group under "Shared with me", has correct permission restrictions, and the email/password login flow works. This also exercises a previously untested auth path (email login).

## New File: `e2e/10-groups/05-group-sharing.spec.ts`

### Constants

```ts
const runId = Date.now()
const otherUserUUID = '4885b7fe-0a19-4151-84a6-1c3c1944a409' // added then removed
const loginUserUUID = '339dd7c0-6c30-4445-bdca-20d0cf90040b' // kept, logged in as
const loginUserEmail = 'test@account.bg'
const loginUserPassword = 'Password1!'
```

### Structure

- Single `test.describe` with `mode: 'serial'`
- **No `beforeEach`** — each test navigates explicitly (avoids auth-state issues after logout)
- Shared mutable `groupName` variable across tests

### Test Cases

| #     | Test                                             | What it does                                                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC001 | Setup - create group                             | Navigate to `/groups`, create `E2E Sharing Group ${runId}`, verify card appears                                                                                                                                                                                                               |
| TC002 | Add first user (to remove later)                 | Open group details dialog, add `otherUserUUID` with default READ permission, verify UUID in list                                                                                                                                                                                              |
| TC003 | Add second user (to login as)                    | Reopen dialog, add `loginUserUUID` with READ only, verify UUID in list                                                                                                                                                                                                                        |
| TC004 | Verify user count is 2                           | On group card, assert `/2 users/i` visible                                                                                                                                                                                                                                                    |
| TC005 | Remove first user                                | Open dialog, scope to `otherUserUUID` row via `dialog.locator('div.flex.items-center.justify-between').filter({ hasText: otherUserUUID })`, click `button.text-destructive`, verify removed but `loginUserUUID` still present                                                                 |
| TC006 | Verify user count is 1                           | Assert `/1 user/i` on card                                                                                                                                                                                                                                                                    |
| TC007 | Logout primary user                              | Click `[data-tour="user-menu-trigger"]`, click menuitem matching `/sign out/i`, wait for redirect to `/`, verify "Welcome to IoM" heading                                                                                                                                                     |
| TC008 | Login as test user (email/password)              | Fill email via `page.getByLabel(/email/i)`, fill password via `page.getByLabel(/password/i)`, click button matching `/sign in with email/i`, wait for redirect to `/objects`, set `onboarding:initial-login:v1=done` in localStorage. **Must NOT save storageState** to `e2e/.auth/user.json` |
| TC009 | Shared filter shows the group                    | Navigate to `/groups`, click filter button, select "Shared" cmdk-item, press Escape, verify group card with `groupName` is visible                                                                                                                                                            |
| TC010 | Card shows READ permission badge, no Owner badge | On the shared group card: assert badge with `/read/i` visible, assert no badge with `/owner/i` visible                                                                                                                                                                                        |
| TC011 | Card has no edit/delete buttons                  | Hover over group name heading — assert no pencil edit button appears. Assert no trash/delete button on card. (Both gated by `canWrite` in `group-card.tsx:171,185`)                                                                                                                           |
| TC012 | Detail sheet has READ-only restrictions          | Open "Group Details": assert no "Add User" button, no pencil on title, no edit/delete buttons on user rows. Switch to Info tab: assert `page.getByRole('switch')` is hidden (visibility is static badge, not toggle). Verify permission section shows "Read". Close dialog                    |
| TC013 | Cleanup - logout test user                       | Sign out the test user so session is clean. Next test run's auth setup will re-authenticate the cert user automatically                                                                                                                                                                       |

### Key Selectors Reference

| Element              | Selector                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Create group button  | `page.getByTestId('create-group-button')`                                                               |
| Group card           | `page.locator('[data-testid^="group-card-"]').filter({ hasText: groupName })`                           |
| Group Details button | `groupCard.getByRole('button', { name: /group details/i })`                                             |
| Dialog               | `page.getByRole('dialog')`                                                                              |
| Add User button      | `dialog.getByRole('button', { name: /add user/i })`                                                     |
| UUID input           | `dialog.getByPlaceholder(/enter user uuid/i)`                                                           |
| Plus (add) button    | `dialog.locator('div.space-y-2.p-3').getByRole('button').filter({ has: page.locator('.lucide-plus') })` |
| User row             | `dialog.locator('div.flex.items-center.justify-between').filter({ hasText: UUID })`                     |
| Remove button        | `userRow.locator('button.text-destructive')`                                                            |
| User menu trigger    | `page.locator('[data-tour="user-menu-trigger"]')`                                                       |
| Sign out item        | `page.getByRole('menuitem').filter({ hasText: /sign out/i })`                                           |
| Email input          | `page.getByLabel(/email/i)`                                                                             |
| Password input       | `page.getByLabel(/password/i)`                                                                          |
| Email login button   | `page.getByRole('button', { name: /sign in with email/i })`                                             |
| Filter button        | `page.getByRole('button', { name: /filter/i })`                                                         |
| Shared filter option | `page.locator('[cmdk-item]').filter({ hasText: /shared/i })`                                            |
| Info tab             | `page.getByRole('tab', { name: /info/i })`                                                              |
| Visibility switch    | `page.getByRole('switch')`                                                                              |

### Important Implementation Notes

1. **Auth state safety**: Never call `page.context().storageState({ path: 'e2e/.auth/user.json' })` after email login — that would overwrite the cert user's saved state and break subsequent runs.

2. **Onboarding overlay**: After email login, must set `localStorage.setItem('onboarding:initial-login:v1', 'done')` via `page.evaluate()` before navigating to groups, or the tour overlay will block interactions.

3. **No modifications to existing files**: File 05 is fully self-contained — creates its own group, adds two users, removes one. Files 01-04 remain unchanged.

4. **`canWrite` logic** (`group-card.tsx`, `group-view-sheet.tsx`): `canWrite = isOwner || canEditGroup(permissions)`. A user with only READ has `canWrite = false`, so edit/delete/add-user buttons are not rendered at all (not just disabled).

5. **Permission source display**: For a user added with READ, the info tab shows permission source as "user" (gray badges), not "owner" (amber) or "public" (green).

## Files to Create

- `e2e/10-groups/05-group-sharing.spec.ts`

## Reference Files (read-only)

- `e2e/10-groups/03-group-users.spec.ts` — patterns for add/remove user selectors
- `e2e/setup/auth.setup.ts` — auth flow reference
- `src/app/(auth)/page.tsx` — email login form structure
- `src/components/navbar/user-profile-dropdown.tsx` — logout trigger
- `src/components/groups/components/group-card.tsx` — `canWrite` gating (lines 171, 185), permission badges (lines 224-267)
- `src/components/groups/components/group-view-sheet.tsx` — `canWrite` gating on add user (line 387), edit name (line 299), user row actions (line 569), visibility switch vs badge (line 644)

## Verification

1. Run `pnpm playwright test e2e/10-groups/05-group-sharing.spec.ts --headed` — all 13 tests should pass
2. Run `pnpm playwright test e2e/10-groups/` — all group tests (files 01-05) pass, no regressions
3. Run full suite `pnpm test:e2e` to confirm auth setup still works after file 05's logout/login cycle
