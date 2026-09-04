import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { restoreSession, signInAs } from '../utils/session'
import { tour } from '../utils/selectors'
import { createObjectWithId } from '../utils/process'

/**
 * Rollups are OWNER-ONLY, and the gate is ownership rather than permission: the node compares
 * `createdBy` and answers a non-owner 404, so a grantee holding `admin` is refused exactly like a
 * stranger. The published schema says so in as many words — "even with a `read` grant on the
 * object" — because a total aggregates a whole subtree, which may contain descendants the reader
 * cannot individually see.
 *
 * `entity-sheet.tsx` therefore gates its query on `createdBy === userId`. Swapping that for
 * `canEdit` is the obvious-looking refactor and would put a console 404 on every shared object.
 */
const second = secondCredentials()

test.afterAll(async ({ browser }) => {
  if (!second) return
  // Signing in as the grantee ends the primary session for the whole ORIGIN, so every write spec
  // scheduled after this file would otherwise run signed out.
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

test.describe('16 - rollups / cross-user', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — the gate needs a grantee'
  )

  test('RU22: a grantee never asks for the totals at all', async ({
    browser,
  }, testInfo) => {
    testInfo.setTimeout(180_000)
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-rollup-shared`
    const shareName = `${tag}-rollup-grant`

    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await signInAs(owner, requireCredentials())
    await createObjectWithId(owner, objectName)

    await owner.goto('/shares')
    await tour(owner, 'sharesCreate').click()
    await owner.getByTestId('share-name').fill(shareName)
    await owner.getByTestId('resource-picker').click()
    await owner.getByTestId('resource-search').fill(objectName)
    await owner
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: objectName })
      .first()
      .click()
    await owner.getByTestId('member-picker').click()
    await owner.getByTestId('member-search').fill(second!.email)
    await owner.locator('[data-testid^="member-option-"]').first().click()
    await owner.getByTestId('share-save').click()
    await expect(
      owner.getByTestId('data-table-row').filter({ hasText: shareName }).first()
    ).toBeVisible()

    const granteeContext = await browser.newContext()
    const grantee = await granteeContext.newPage()

    // Assert on the REQUEST, not on the absence of a card: no card is also what a correct empty
    // state looks like, so a visual check would pass just as happily against a 404 storm.
    const rollupCalls: string[] = []
    grantee.on('request', (r) => {
      if (r.url().includes('/rollups')) rollupCalls.push(r.url())
    })

    await signInAs(grantee, second!)
    await grantee.goto('/objects')
    await expect(grantee.getByTestId('data-table')).toBeVisible()
    await grantee.getByTestId('filter-menu').click()
    await grantee.getByTestId('filter-option-shared').click()
    await grantee.keyboard.press('Escape')

    const row = grantee
      .getByTestId('data-table-row')
      .filter({ hasText: objectName })
      .first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.getByTestId('object-details-button').click()
    await expect(grantee.getByRole('dialog')).toBeVisible()
    await grantee.waitForTimeout(4_000)

    expect(rollupCalls, 'a grantee must never request /rollups').toEqual([])

    await ownerContext.close()
    await granteeContext.close()
  })
})
