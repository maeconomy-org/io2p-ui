import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { restoreSession, signInAs } from '../utils/session'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'
import { tour } from '../utils/selectors'

/**
 * A share crossing a HIERARCHY — the gap between the two things this suite tests separately.
 *
 * Hierarchy is covered single-user and sharing is covered flat, so nothing exercised a grantee
 * opening a shared PARENT. `/objects/[uuid]` asks the node for `?parent=<id>`, and the node defaults
 * objects to `scope: 'mine'`: the children belong to the OWNER, so a grantee's children page came
 * back empty and the object looked like a leaf. `page.tsx` passes `scope: 'all'` for exactly this,
 * and until now nothing proved it.
 *
 * **Every object is shared explicitly, parent and children alike.** Measured against the node: a
 * grant on a parent does NOT reach its children — the grantee reads the parent 200 and
 * `?parent=<id>&scope=all` still comes back empty. So a bundle holding only the parent would test
 * the cascade the node does not do, and would fail for a reason that has nothing to do with scope.
 *
 * The `scope` on the request is asserted beside the rows. Rows can be absent for reasons unrelated
 * to the grant, and the request is the thing the fix changed.
 */
const second = secondCredentials()

/**
 * Signing in as the grantee ENDS the primary account's session for the whole origin. `afterAll`,
 * not the test's last step: the run where this matters is the run where the test FAILED.
 */
test.afterAll(async ({ browser }) => {
  if (!second) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function createObject(
  page: Page,
  name: string,
  parentName?: string
): Promise<void> {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  if (parentName) {
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: parentName })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')
  }

  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

async function shareWithSecond(
  page: Page,
  shareName: string,
  resourceNames: string[]
): Promise<void> {
  await page.goto('/shares')
  await tour(page, 'sharesCreate').click()
  await page.getByTestId('share-name').fill(shareName)

  for (const resourceName of resourceNames) {
    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(resourceName)
    await page
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: resourceName })
      .first()
      .click()
  }

  await page.getByTestId('member-picker').click()
  await page.getByTestId('member-search').fill(second!.email)
  const member = page.locator('[data-testid^="member-option-"]').first()
  await expect(member).toBeVisible()
  await member.click()

  await expect(page.getByTestId('share-save')).toBeEnabled()
  await page.getByTestId('share-save').click()
  await expect(rowFor(page, shareName)).toBeVisible()
}

test.describe('11 - shares / hierarchy', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a grantee is the whole case'
  )

  test('SH1: a grantee opening a shared parent sees its children', async ({
    browser,
  }) => {
    const tag = `e2e-${Date.now()}`
    const parent = `${tag}-shared-parent`
    const childA = `${tag}-child-a`
    const childB = `${tag}-child-b`
    const shareName = `${tag}-hierarchy`

    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await signInAs(owner, requireCredentials())

    await owner.goto('/objects')
    await expect(owner.getByTestId('data-table')).toBeVisible()
    await createObject(owner, parent)
    await createObject(owner, childA, parent)
    await createObject(owner, childB, parent)

    await rowFor(owner, parent).dblclick()
    await expect(owner).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    const parentUrl = owner.url()

    // The children are in the bundle too. They stay the OWNER's objects, which is what makes the
    // grantee's children request need `scope: 'all'` — `mine` drops every one of them.
    await shareWithSecond(owner, shareName, [parent, childA, childB])

    const granteeContext = await browser.newContext()
    const grantee = await granteeContext.newPage()
    await signInAs(grantee, second!)

    const childCalls: string[] = []
    grantee.on('request', (request) => {
      const url = new URL(request.url())
      if (
        /\/objects\?/.test(url.pathname + url.search) &&
        !url.search.includes('_rsc')
      ) {
        childCalls.push(url.search)
      }
    })

    await grantee.goto(parentUrl)

    await expect(rowFor(grantee, childA)).toBeVisible({ timeout: 20_000 })
    await expect(rowFor(grantee, childB)).toBeVisible()

    // `scope=mine` here is the regression, and it renders as an object that merely looks childless.
    const parentQuery = childCalls.find((search) => search.includes('parent='))
    expect(parentQuery, 'no children request was made').toBeDefined()
    expect(parentQuery).toContain('scope=all')

    await ownerContext.close()
    await granteeContext.close()
  })
})
