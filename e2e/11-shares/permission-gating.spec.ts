import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'
import { tour } from '../utils/selectors'
import { restoreSession, signInAs } from '../utils/session'

/**
 * What the row menu OFFERS is the access check the user actually sees.
 *
 * `canReshare` needs `share` and `canDelete` needs `admin`, so a default grant —
 * `read` — must show neither. A regression here is silent: the control opens a
 * sheet that can only 403, and nothing on the happy path notices.
 *
 * `cross-user.spec.ts` proves the grantee can SEE the object. This file is the
 * other half: what they may do with it.
 */
const second = secondCredentials()

test.afterAll(async ({ browser }) => {
  if (!second) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

async function shareObjectWith(
  owner: Page,
  objectName: string,
  shareName: string,
  email: string
): Promise<void> {
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
  await owner.getByTestId('member-search').fill(email)
  const member = owner.locator('[data-testid^="member-option-"]').first()
  await expect(member).toBeVisible()
  await member.click()

  await owner.getByTestId('share-save').click()
  await expect(
    owner.getByTestId('data-table-row').filter({ hasText: shareName }).first()
  ).toBeVisible()
}

/** Open the row's menu and return it, so absence can be asserted against an OPEN menu. */
async function openRowMenu(page: Page, name: string) {
  const row = page
    .getByTestId('data-table-row')
    .filter({ hasText: name })
    .first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByTestId('object-actions-dropdown').click()
  return row
}

test.describe('11 - shares / permission gating', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a grant needs a member'
  )

  test('SP1: a read-only grantee is offered neither Share nor Delete', async ({
    browser,
  }) => {
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-gated`

    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await signInAs(owner, requireCredentials())
    await createObjectWithId(owner, objectName)
    await shareObjectWith(owner, objectName, `${tag}-bundle`, second!.email)

    const granteeContext = await browser.newContext()
    const grantee = await granteeContext.newPage()
    await signInAs(grantee, second!)

    await grantee.goto('/objects')
    await expect(grantee.getByTestId('data-table')).toBeVisible()
    await grantee.getByTestId('filter-menu').click()
    await grantee.getByTestId('filter-option-shared').click()
    await grantee.keyboard.press('Escape')

    await openRowMenu(grantee, objectName)

    // The menu is OPEN, so these are absent because the grant withholds them —
    // not because nothing has rendered yet.
    await expect(grantee.getByTestId('object-action-show-qr')).toBeVisible()
    await expect(grantee.getByTestId('object-action-share')).toHaveCount(0)
    await expect(grantee.getByTestId('object-action-delete')).toHaveCount(0)

    await ownerContext.close()
    await granteeContext.close()
  })

  test('SP2: the author holds admin on their own object and is offered both', async ({
    page,
  }) => {
    const objectName = `e2e-${Date.now()}-owned`
    await createObjectWithId(page, objectName)

    await page.goto('/objects')
    await openRowMenu(page, objectName)

    // The counterweight to SP1: the same two controls, on a row whose viewer is
    // the author. Without this pair, SP1 would pass on a menu that renders
    // nothing at all.
    await expect(page.getByTestId('object-action-share')).toBeVisible()
    await expect(page.getByTestId('object-action-delete')).toBeVisible()
  })
})
