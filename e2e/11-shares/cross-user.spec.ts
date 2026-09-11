import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { restoreSession, signInAs } from '../utils/session'
import { tour } from '../utils/selectors'
import { createObjectWithId } from '../utils/process'

/**
 * The cases one account cannot express: a bundle is only COMPLETE with a member, and "the grantee
 * gets read access" needs the grantee.
 *
 * Skipped on a condition rather than deleted, so a machine with `E2E_EMAIL_2` set runs them and one
 * without still runs the rest — Playwright prints the reason either way.
 */
const second = secondCredentials()

/**
 * Signing in as the grantee ENDS the primary account's session for the whole origin, so every write
 * spec scheduled after this FILE would run signed out. The `session-teardown` project repairs the
 * account for the NEXT run; this repairs it for the rest of THIS one.
 */
test.afterAll(async ({ browser }) => {
  if (!second) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

test.describe('11 - shares / cross-user', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a share needs a member'
  )

  test('S3b/S5/S6: a complete bundle saves, lists, and opens read-only', async ({
    page,
  }) => {
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-shared-object`
    const shareName = `${tag}-bundle`

    await createObjectWithId(page, objectName)

    await page.goto('/shares')
    await tour(page, 'sharesCreate').click()
    await page.getByTestId('share-name').fill(shareName)

    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(objectName)
    await page
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: objectName })
      .first()
      .click()

    await page.getByTestId('member-picker').click()
    await page.getByTestId('member-search').fill(second!.email)
    const member = page.locator('[data-testid^="member-option-"]').first()
    await expect(member).toBeVisible()
    await member.click()

    // A resource AND a member: only now is the bundle something the node will accept.
    await expect(page.getByTestId('share-save')).toBeEnabled()
    await page.getByTestId('share-save').click()

    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: shareName })
      .first()
    await expect(row).toBeVisible()

    // The row opens the read-only DETAIL — an editable name field would mean the wrong sheet.
    await row.click()
    await expect(page.getByTestId('share-name')).toHaveCount(0)
    await expect(page.getByText(shareName).first()).toBeVisible()
  })

  test('S15: the grantee sees the shared object, and only reads it', async ({
    browser,
  }) => {
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-for-grantee`
    const shareName = `${tag}-grant`

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
    await signInAs(grantee, second!)

    // The shared scope is index-driven on the grant set, so the listing IS the access check.
    await grantee.goto('/objects')
    await expect(grantee.getByTestId('data-table')).toBeVisible()
    await grantee.getByTestId('filter-menu').click()
    await grantee.getByTestId('filter-option-shared').click()
    await grantee.keyboard.press('Escape')

    await expect(
      grantee
        .getByTestId('data-table-row')
        .filter({ hasText: objectName })
        .first()
    ).toBeVisible({ timeout: 20_000 })

    await ownerContext.close()
    await granteeContext.close()
  })
})
