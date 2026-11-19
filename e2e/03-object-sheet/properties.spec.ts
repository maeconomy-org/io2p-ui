import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  switchTab,
} from '../utils/sheet'

const stamp = () => `e2e-${Date.now()}`

async function seedObject(page: import('@playwright/test').Page, tag: string) {
  const name = `${stamp()}-${tag}`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, 'Weight', '12')
  await saveSheet(page)
  await expect(panel).toBeHidden()
  return name
}

function rowFor(page: import('@playwright/test').Page, name: string) {
  return page.locator('tr').filter({ hasText: name }).first()
}

test.describe('03 - object sheet / properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('P1/P3: a changed value persists across save and reopen', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p1')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('34')
    await saveSheet(page)

    await page.reload()
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('34')
  })

  test('P4: a second value can be added to a property', async ({ page }) => {
    const name = await seedObject(page, 'p4')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    await page.getByTestId('property-add-value-0').click()
    await page.getByTestId('property-value-0-1').fill('99')
    await saveSheet(page)

    await page.reload()
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-value-0-1')).toHaveValue('99')
  })

  test('P5: deleting a property WITH content takes two clicks', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p5')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await page.getByTestId('property-remove-0').click()
    await expect(page.getByTestId('property-remove-confirm-0')).toBeVisible()
    await expect(page.getByTestId('property-row-0')).toBeVisible()

    await page.getByTestId('property-remove-confirm-0').click()
    await expect(page.getByTestId('property-deleted-0')).toBeVisible()
  })

  test('P6: deleting an EMPTY property goes on the first click', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p6')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await addProperty(page, 1)
    await page.getByTestId('property-remove-1').click()

    await expect(page.getByTestId('property-row-1')).toHaveCount(0)
    await expect(page.getByTestId('property-remove-confirm-1')).toHaveCount(0)
  })

  test('P7: the confirm state cancels on blur', async ({ page }) => {
    const name = await seedObject(page, 'p7')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await page.getByTestId('property-remove-0').click()
    await expect(page.getByTestId('property-remove-confirm-0')).toBeVisible()

    await page.getByTestId('sheet-tab-details').click()
    await page.getByTestId('sheet-tab-properties').click()

    await expect(page.getByTestId('property-remove-confirm-0')).toHaveCount(0)
    await expect(page.getByTestId('property-remove-0')).toBeVisible()
  })

  test('P8/P10: a stored property soft-deletes, restores, and survives a round trip', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p8')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await page.getByTestId('property-remove-0').click()
    await page.getByTestId('property-remove-confirm-0').click()

    const deleted = page.getByTestId('property-deleted-0')
    await expect(deleted).toBeVisible()
    await expect(page.getByTestId('property-deleted-0-restore')).toBeVisible()

    await page.getByTestId('property-deleted-0-restore').click()
    await expect(page.getByTestId('property-row-0')).toBeVisible()
    await saveSheet(page)

    await page.reload()
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('12')
  })

  test('P9: a never-stored property is removed outright, not marked', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p9')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await addProperty(page, 1)
    await fillProperty(page, 1, 'Temp', 'x')
    await page.getByTestId('property-remove-1').click()
    await page.getByTestId('property-remove-confirm-1').click()

    await expect(page.getByTestId('property-row-1')).toHaveCount(0)
    await expect(page.getByTestId('property-deleted-1')).toHaveCount(0)
  })

  test('P11: a stored VALUE follows the same soft-delete rule', async ({
    page,
  }) => {
    const name = await seedObject(page, 'p11')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    await page.getByTestId('value-remove-0-0').click()
    await expect(page.getByTestId('value-deleted-0-0')).toBeVisible()

    await page.getByTestId('value-deleted-0-0-restore').click()
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('12')
  })

  test('P12: the property-name combobox offers dictionary suggestions', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(`${stamp()}-p12`)

    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('wei')

    await expect(page.getByTestId('property-name-suggestions')).toBeVisible()
  })

  test('T2 follow-up: an edit survives a tab switch, though the row re-collapses', async ({
    page,
  }) => {
    const name = await seedObject(page, 'tabs')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('501')

    await switchTab(page, 'details')
    await switchTab(page, 'properties')

    // Radix unmounts the inactive panel, so the row re-collapses; the value lives in RHF above it.
    await expect(page.getByTestId('unsaved-bar')).toBeVisible()

    await expandProperty(page, 0)
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('501')
  })
})
