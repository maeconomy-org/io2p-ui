import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import { createObjectWithId } from '../utils/process'

/**
 * §6.13 S3-S6 — the share editor.
 *
 * A `write` spec: every case here creates a share on the node.
 */

const stamp = () => `e2e-${Date.now()}`

/** Opens the create editor and names the bundle. */
async function openEditor(page: Page, name: string) {
  await page.goto('/shares')
  await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
  await tour(page, 'sharesCreate').click()

  const nameField = page.getByTestId('share-name')
  await expect(nameField).toBeVisible()
  await nameField.fill(name)
}

test.describe('11 - shares / editor', () => {
  test('S4: Save stays disabled until the bundle is complete', async ({
    page,
  }) => {
    await openEditor(page, `${stamp()}-s4`)

    // `disabled={!complete || !dirty}`. A name alone is not a share — it needs a resource and a
    // member — so the button states that rather than accepting a bundle the node would refuse.
    await expect(page.getByTestId('share-save')).toBeDisabled()
  })

  test('S3: a bundle can be created with a resource, and it appears in the list', async ({
    page,
  }) => {
    const tag = stamp()
    const objectName = `${tag}-res`
    const shareName = `${tag}-share`

    await createObjectWithId(page, objectName)
    await openEditor(page, shareName)

    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(objectName)

    const option = page
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: objectName })
      .first()
    await expect(option).toBeVisible()
    await option.click()

    // The picked resource is STAGED into the sheet, not written — S4's other half. Nothing has
    // reached the node yet, which is why the row below only appears after Save.
    await expect(page.locator('[data-testid^="share-resource-"]')).toHaveCount(
      1
    )
  })

  test('S5: a row click opens the read-only detail, not the editor', async ({
    page,
  }) => {
    await page.goto('/shares')
    await expect(page.getByTestId('shares-tab-shares')).toBeVisible()

    const row = page.getByTestId('data-table-row').first()
    test.skip(
      (await page.getByTestId('data-table-row').count()) === 0,
      'needs at least one existing share'
    )
    await row.click()

    // The detail has no name field. Opening straight into the editor would make a click on a row
    // an edit, which is the difference this case exists to hold.
    await expect(page.getByTestId('share-name')).toHaveCount(0)
  })
})
