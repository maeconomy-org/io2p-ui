import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'
import { restoreSession, signInAs } from '../utils/session'

/**
 * A revoke is only proved by a RELOAD.
 *
 * The sheet drops the row from its own draft the moment you click, so every
 * on-screen signal is green whether or not the grant reached the node. A revoke
 * that silently no-ops leaves the grantee reading the object indefinitely, and
 * nothing in the UI says so.
 *
 * The second half — the grantee's own session losing the row — is the assertion
 * that cannot be faked by local state at all.
 */
const second = secondCredentials()

test.afterAll(async ({ browser }) => {
  if (!second) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

test.describe('11 - shares / revoke', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a revoke needs a grantee'
  )

  test('S12: a revoke survives a reload, and the grantee loses the object', async ({
    browser,
  }) => {
    const objectName = `e2e-${Date.now()}-revoked`

    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await signInAs(owner, requireCredentials())
    await createObjectWithId(owner, objectName)

    await owner.goto('/objects')
    const row = owner
      .getByTestId('data-table-row')
      .filter({ hasText: objectName })
      .first()
    await expect(row).toBeVisible()
    await row.getByTestId('object-actions-dropdown').click()
    await owner.getByTestId('object-action-share').click()

    // The people-picker popover is ALSO `role="dialog"`, so the sheet is named
    // rather than taken as the only one.
    const sheet = owner.getByRole('dialog', { name: /share/i })
    await expect(sheet).toBeVisible()

    // The picker searches the SERVER (`shouldFilter={false}`), so an empty box
    // offers nobody. SS2 gets away with a bare `getByRole('option')` because it
    // only asserts that nothing was written; this case needs a real grantee.
    await owner.getByTestId('share-add-people').click()
    await owner.getByPlaceholder(/search/i).fill(second!.email)

    const option = owner.getByRole('option').first()
    await expect(option).toBeVisible({ timeout: 15_000 })
    await option.click()

    // The draft key is minted by the sheet, so it is read off the DOM rather
    // than guessed. Keyed by SUBJECT: counting rows would pass just as happily
    // if a DIFFERENT grantee were the one that vanished.
    const member = sheet.locator('[data-testid^="share-member-"]').first()
    const memberTestId = await member.getAttribute('data-testid')
    const subjectId = memberTestId!.replace('share-member-', '')

    await owner.getByTestId('share-sheet-save').click()
    await expect(sheet).toBeHidden()

    // Reopened, so the grant is read back from the node and not from the draft
    // that was just on screen.
    await row.getByTestId('object-actions-dropdown').click()
    await owner.getByTestId('object-action-share').click()
    await expect(owner.getByTestId(`share-member-${subjectId}`)).toBeVisible()

    await owner.getByTestId(`share-member-remove-${subjectId}`).click()
    await owner.getByTestId('share-sheet-save').click()
    await expect(sheet).toBeHidden()

    // The whole point of the case: the sheet already showed the row gone before
    // Save, so only a re-read proves the node agreed.
    await owner.reload()
    await expect(row).toBeVisible()
    await row.getByTestId('object-actions-dropdown').click()
    await owner.getByTestId('object-action-share').click()
    await expect(owner.getByTestId(`share-member-${subjectId}`)).toHaveCount(0)

    await ownerContext.close()
  })
})
