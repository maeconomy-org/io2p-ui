import { expect, test } from '../fixtures/app'
import {
  addProperty,
  fillProperty,
  openCreateSheet,
  saveSheet,
} from '../utils/sheet'

const stamp = () => `e2e-${Date.now()}`

test.describe('03 - object sheet / create', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('C2: the create sheet renders no tabs', async ({ page }) => {
    await openCreateSheet(page)

    await expect(page.locator('[data-testid^="sheet-tab-"]')).toHaveCount(0)
  })

  test('C3: Save is disabled until something is entered', async ({ page }) => {
    await openCreateSheet(page)

    await expect(page.getByTestId('sheet-save')).toBeDisabled()
  })

  test('C4: a whitespace-only name is rejected once the form is dirty', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill('   ')

    const save = page.getByTestId('sheet-save')
    await expect(save).toBeEnabled()
    await save.click()

    await expect(panel).toBeVisible()
    await expect(save).toBeVisible()
  })

  test('C1: name only — created, and it appears in the list', async ({
    page,
  }) => {
    const name = `${stamp()}-c1`
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill(name)
    await saveSheet(page)

    await expect(panel).toBeHidden()
    await expect(page.getByRole('cell', { name, exact: false })).toBeVisible()
  })

  test('C5: name plus two properties round-trips', async ({ page }) => {
    const name = `${stamp()}-c5`
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await fillProperty(page, 0, 'Weight', '12 kg')
    await addProperty(page, 1)
    await fillProperty(page, 1, 'Colour', 'red')

    await saveSheet(page)
    await expect(panel).toBeHidden()

    await expect(page.getByRole('cell', { name, exact: false })).toBeVisible()
  })
})
