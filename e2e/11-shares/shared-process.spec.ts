import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { rowActions, tour } from '../utils/selectors'
import { createObjectWithId, createProcess } from '../utils/process'
import { patchPreferences } from '../utils/preferences'
import { restoreSession, signInAs } from '../utils/session'
import { gotoList, sheet, switchTab } from '../utils/sheet'

/**
 * R4 — a process shared WITH you names the objects inside it, which are not yours.
 *
 * The direction is the case. `hierarchy.spec.ts` shares from the primary account outward; here the
 * second account owns everything and the primary is the grantee, because the hazard only exists on
 * the reading side: a process's flow rows resolve their `ref` through an objects read, and the node
 * defaults objects to `scope: 'mine'`. Every object in a shared process belongs to the SHARER, so
 * `mine` drops all of them and the grantee gets flow rows pointing at nothing — a process that
 * renders, with inputs and outputs that are blank.
 *
 * That failure is quiet in the way this suite keeps finding: the sheet opens, the tabs are there,
 * the counts on the list row are right, and only the names are missing. Asserting the tab or the
 * row would pass through it, so the assertion is the object's NAME inside the flow row.
 *
 * DESTRUCTIVE to the shared session — it signs in as the second account to create and share, so it
 * owes an unconditional `restoreSession`. The teardown also deletes what it made, and it has to do
 * that AS the second account, which is why the hook switches twice and ends in a `finally`.
 */

const second = secondCredentials()

/** What this run made on the SECOND account, so the teardown finds it after a failure too. */
const created: {
  objectName: string | null
  processName: string | null
  share: string | null
} = {
  objectName: null,
  processName: null,
  share: null,
}

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function deleteRow(
  page: Page,
  path: string,
  prefix: 'object' | 'process' | 'share',
  name: string
): Promise<void> {
  await gotoList(page, path)
  // SETTLE before counting. `gotoList` waits for the table SHELL, and `DataTable` renders loading
  // rows while it fetches — so a bare `count()` here reads 0 for a row that is about to appear, the
  // helper reports nothing to do, and the `catch` above swallows nothing because nothing threw.
  // Best-effort cleanup plus a silent no-op is indistinguishable from cleanup that worked.
  const row = page.getByTestId('data-table-row').filter({ hasText: name })
  try {
    await expect(row.first()).toBeVisible({ timeout: 15_000 })
  } catch {
    return
  }
  const actions = rowActions(page, prefix, row.first())
  await actions.menu.click()
  await actions.action('delete').click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /delete/i })
    .click()
  await expect(row).toHaveCount(0, { timeout: 15_000 })
}

/**
 * TWO hooks, and the ORDER IS DECLARATION ORDER — measured, not assumed.
 *
 * An earlier version of this comment said Playwright runs `afterAll` in REVERSE declaration order
 * and declared the restore first on that basis. It is wrong, and it inverted the outcome: the
 * cleanup's `signInAs(second)` ran AFTER the restore, so the run ended with the second account live
 * and `AUTH_STATE` holding a session the node had already killed — the exact cascade the split
 * exists to prevent, and one with no failing probe, just a later spec 401ing for no visible reason.
 *
 * Playwright reverses for `afterEach`, and only across suite NESTING; `_runAllHooksForSuite`
 * iterates one suite's hooks forward. Confirmed with two logging hooks in a throwaway spec.
 *
 * The reason for splitting stands: a hook's budget is not shared with the test's, and a `finally`
 * does NOT survive its own hook being killed — this teardown was one hook whose cleanup overran
 * 180s, so the `restoreSession` inside its `finally` never ran and the failure surfaced on a test
 * that had already passed. Separate budgets are what stop the cleanup starving the restore. The
 * order is what makes the restore the last thing that happens.
 */

/** Declared FIRST so it runs first — everything here needs the second account's own session. */
test.afterAll(async ({ browser }, testInfo) => {
  if (!second) return
  testInfo.setTimeout(240_000)
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    // The artefacts belong to the SECOND account, so only that account can remove them — a grantee
    // holds read here and the node would refuse.
    await signInAs(page, second)
    if (created.share) await deleteRow(page, '/shares', 'share', created.share)
    if (created.processName) {
      await deleteRow(page, '/processes', 'process', created.processName)
    }
    if (created.objectName) {
      await deleteRow(page, '/objects', 'object', created.objectName)
    }
  } catch {
    // Cleanup is the nice-to-have; the restore is not. Swallowing here keeps a slow or failed
    // delete from reporting as a test failure on a case that already passed.
  } finally {
    await context.close()
  }
})

/** Declared LAST so it runs last, after the cleanup's sign-in has ended the primary session. */
test.afterAll(async ({ browser }, testInfo) => {
  if (!second) return
  testInfo.setTimeout(120_000)
  const context = await browser.newContext()
  const page = await context.newPage()
  // Unconditional, and to a known account. One live session per origin, so leaving the second
  // account signed in 401s every later write spec.
  await restoreSession(page)
  await context.close()
})

test.describe('11 - shares / a process shared with you', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — the sharer is the second account'
  )

  test('R4: the objects inside a shared process are still named', async ({
    browser,
  }, testInfo) => {
    // Two sign-ins, an object, a process and a bundle before the first assertion. The default 60s
    // is spent well before the case reaches what it is testing, and it then fails as `Test ended`
    // at whatever `fill` was in flight — which names nothing.
    testInfo.setTimeout(240_000)
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-r4-obj`
    const processName = `${tag}-r4-proc`
    const shareName = `${tag}-r4`
    created.objectName = objectName
    created.processName = processName
    created.share = shareName

    const owner = await (await browser.newContext()).newPage()
    await signInAs(owner, second!)

    // ENGLISH ON THE SECOND ACCOUNT, set rather than assumed — and this is not defensive padding.
    // That account was found sitting in Dutch, and every create helper in this suite reaches for
    // `getByLabel(/name/i)`, which matches nothing against a form reading "Naam". The result is not
    // an assertion error: `createObjectWithId` hangs until the case times out and reports
    // `locator.fill: Test ended`, naming nothing. That cost two four-minute runs.
    //
    // `patchPreferences`, NOT `setLanguage`, and that was measured. `setLanguage` early-returns when
    // `appearance-language-en` already reads `aria-pressed="true"` — and on a FRESH context there is
    // no `iom_prefs` cookie, so the server first-paints English while the account still says Dutch.
    // The helper reads the control, sees English, writes nothing, and returns; the app then renders
    // Dutch the moment `/me` resolves. That is the parked `13-preferences/self-heal` bug arriving
    // from the other side. The API path has no control to misread.
    //
    // NOT restored to Dutch afterwards, deliberately. Every spec that drives this account's UI needs
    // English for the same reason, so putting it back would only re-arm the trap for the next one.
    await owner.goto('/objects')
    await patchPreferences(owner, { locale: { app: 'en' } })
    await owner.reload()
    await expect(owner.getByRole('link', { name: 'Objects' })).toBeVisible()

    // The object doubles as the input and the output — a process needs one of each, and one ref
    // keeps this to a single object the teardown has to chase.
    await createObjectWithId(owner, objectName)
    await createProcess(owner, processName, [objectName], objectName)

    await owner.goto('/shares')
    await tour(owner, 'sharesCreate').click()
    await owner.getByTestId('share-name').fill(shareName)
    await owner.getByTestId('resource-picker').click()
    await owner.getByTestId('resource-search').fill(processName)
    await owner
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: processName })
      .first()
      .click()

    // The PROCESS only. The object is deliberately left out of the bundle: `mine` versus `all` is
    // about how the flow row resolves a ref it is allowed to see through the process, and sharing
    // the object too would give the grantee a direct grant that makes `mine` sufficient — the case
    // would pass with the bug in place.
    await owner.getByTestId('member-picker').click()
    await owner.getByTestId('member-search').fill(requireCredentials().email)
    const member = owner.locator('[data-testid^="member-option-"]').first()
    await expect(member).toBeVisible()
    await member.click()
    await expect(owner.getByTestId('share-save')).toBeEnabled()
    await owner.getByTestId('share-save').click()
    await expect(rowFor(owner, shareName)).toBeVisible()

    // Back to the primary account, which is now the GRANTEE.
    const grantee = await (await browser.newContext()).newPage()
    await restoreSession(grantee)

    await gotoList(grantee, '/processes')
    const row = rowFor(grantee, processName)
    await expect(row).toBeVisible()
    await row.getByTestId('process-details-button').click()
    await expect(sheet(grantee)).toBeVisible()

    // The NAME, in both bags. A flow whose ref did not resolve still renders a row — the same row
    // with nothing where the object should be — so the row's presence proves nothing and the count
    // proves nothing either.
    //
    // `flow-row-*` is an EDIT-mode testid and a grantee holds read here, so the read view is all
    // there is: each flow is a Collapsible trigger carrying the object's name. Same shape as the
    // property read view in PR5, addressed the same way.
    const named = (page: Page) =>
      sheet(page).getByRole('button').filter({ hasText: objectName })

    await switchTab(grantee, 'inputs')
    await expect(named(grantee)).toHaveCount(1)
    await switchTab(grantee, 'outputs')
    await expect(named(grantee)).toHaveCount(1)
  })
})
