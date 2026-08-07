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

/**
 * §6.7 — properties and values.
 *
 * The delete semantics are the part with no prior coverage and the most ways to be subtly wrong:
 * confirm-on-second-click but only when the row has content, cancel-on-blur, and soft delete that
 * leaves the row struck through rather than removing it.
 */

const stamp = () => `e2e-${Date.now()}`

async function seedObject(page: import('@playwright/test').Page, tag: string) {
  const name = `${stamp()}-${tag}`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, 'Weight', '12')
  await page.getByTestId('sheet-save').click()
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

    // First click arms; the row must still be there. The old TC042 called this "double-click
    // confirm", which describes a different gesture entirely.
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

    // A row with no name, no value and no files has nothing to confirm — `hasContent` is false, so
    // the confirm state is skipped entirely.
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

    // `onBlur={() => setConfirmDelete(false)}` — clicking anything else disarms it, so an armed
    // confirm can never be left lying in wait for an unrelated click.
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

    // P8: never vanishes — struck through, with a way back.
    const deleted = page.getByTestId('property-deleted-0')
    await expect(deleted).toBeVisible()
    await expect(page.getByTestId('property-deleted-0-restore')).toBeVisible()

    // P10: restore, save, reopen — the property is live again WITH its value, not an empty shell.
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

    // Nothing to soft-delete: the server has never seen it, so there is no DeletedRow.
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

    // A value has no confirm step — one click marks it.
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

    // These two testids survived the refactor — the plumbing around them did not.
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

    // Radix unmounts the inactive panel, so PropertyRow's `open` is local state that resets — the
    // row comes back COLLAPSED. The value does not live there: it is in react-hook-form, above the
    // tabs, which is what makes one form across four tabs work at all. The dirty bar proves the
    // edit is still pending before the row is even re-opened.
    await expect(page.getByTestId('unsaved-bar')).toBeVisible()

    await expandProperty(page, 0)
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('501')
  })
})
