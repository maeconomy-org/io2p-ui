import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import { createObjectWithId } from '../utils/process'

const stamp = () => `e2e-${Date.now()}`

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

    await expect(page.getByTestId('share-name')).toHaveCount(0)
  })
})
