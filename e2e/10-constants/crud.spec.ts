import { expect, test } from '../fixtures/app'
import { openDialog } from '../utils/sheet'
import { tour } from '../utils/selectors'

/**
 * A constant's versions are APPEND-ONLY: a calc that pinned version 1 must keep evaluating to the
 */

const stamp = () => `e2e-${Date.now()}`

test.describe('10 - constants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/constants')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('CO1: a constant can be created and appears in the list', async ({
    page,
  }) => {
    const name = `${stamp()}-co`
    await tour(page, 'constantsCreate').click()

    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(name)
    await dialog.getByLabel(/value/i).first().fill('0.42')

    await page
      .getByRole('button', { name: /create constant/i })
      .last()
      .click()

    await expect(
      page.getByTestId('data-table-row').filter({ hasText: name })
    ).toHaveCount(1)
  })

  test('CO2: editing a constant appends a version rather than replacing it', async ({
    page,
  }) => {
    const name = `${stamp()}-co2`

    await tour(page, 'constantsCreate').click()
    await page.locator('#constant-name').fill(name)
    await page.locator('#constant-data').fill('1')
    await page
      .getByRole('button', { name: /create constant/i })
      .last()
      .click()

    const row = page.getByTestId('data-table-row').filter({ hasText: name })
    await expect(row).toHaveCount(1)

    await row.getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-edit').click()

    // The name is DISABLED on edit — renaming a constant would orphan every calc that pinned it by
    await expect(page.locator('#constant-name')).toBeDisabled()
    await page.locator('#constant-data').fill('2')

    // append-only, so editing one never replaces what a calc already pinned.
    const addVersion = page.getByRole('button', { name: /add version/i }).last()
    await expect(addVersion).toBeEnabled()
    await addVersion.click()

    await expect(row).toHaveCount(1)
    await row.getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-edit').click()

    const history = page.getByTestId('constant-versions')
    await expect(history).toBeVisible()
    await expect(history).toContainText('1')
    await expect(history).toContainText('2')
  })
})
