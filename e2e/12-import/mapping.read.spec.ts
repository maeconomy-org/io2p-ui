import { expect, test } from '../fixtures/app'
import {
  importLimits,
  loadAndMap,
  loadSheet,
  openWizard,
  setColumnSplit,
  setColumnTarget,
  statValue,
} from '../utils/import'

test.describe('12 - import / mapping', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page)
  })

  test('I16/I17: every column gets a row with its real samples, and nothing is dropped', async ({
    page,
  }) => {
    await loadAndMap(page, 'flat.csv')

    await expect(page.getByTestId('map-column-0')).toContainText('North Gate')
    await expect(page.getByTestId('map-column-1')).toContainText(
      'Main entrance building'
    )
    // `size` matches no field, so it falls through to a property rather than to nothing.
    await expect(page.getByTestId('map-column-2')).toContainText('size')
    await expect(page.getByTestId('map-target-2')).toContainText('Property')
  })

  test('I18: mapping a column to Name unblocks Continue', async ({ page }) => {
    await loadAndMap(page, 'noname.csv')
    await expect(page.getByTestId('wizard-next')).toBeDisabled()

    await setColumnTarget(page, 0, 'name')

    await expect(page.getByTestId('wizard-blocked')).toHaveCount(0)
    await expect(page.getByTestId('wizard-next')).toBeEnabled()
  })

  test('I19: a key column with no parent column says so', async ({ page }) => {
    await loadAndMap(page, 'keys.csv')
    await expect(page.getByTestId('map-inert-0')).toHaveCount(0)

    await setColumnTarget(page, 1, 'skip')

    await expect(page.getByTestId('map-inert-0')).toHaveAttribute(
      'data-reason',
      'noParent'
    )
  })

  test('I20: with levels on, key and parent are both inert', async ({
    page,
  }) => {
    await loadAndMap(page, 'keys.csv')
    await page.getByTestId('map-level-2').click()

    await expect(page.getByTestId('map-inert-0')).toHaveAttribute(
      'data-reason',
      'levelsWin'
    )
    await expect(page.getByTestId('map-inert-1')).toHaveAttribute(
      'data-reason',
      'levelsWin'
    )
  })

  test('I21: a non-ASCII header survives and is carried as a property', async ({
    page,
  }) => {
    await loadAndMap(page, 'unicode.csv')

    await expect(page.getByTestId('map-column-1')).toContainText('Größe')
    await expect(page.getByTestId('map-target-1')).toContainText('Property')

    await page.getByTestId('wizard-next').click()
    expect(await statValue(page, 'objects')).toBe(3)
    // The header keys as `grosse`; what this guards is that it keys as ANYTHING. A header the
    // slug empties is a column dropped whole, and its three cells go missing from the total.
    expect(await statValue(page, 'values')).toBe(6)
  })

  test('I22: splitting on a delimiter turns one cell into several values', async ({
    page,
  }) => {
    await loadAndMap(page, 'unicode.csv')
    await page.getByTestId('wizard-next').click()
    const before = await statValue(page, 'values')

    await page.getByTestId('wizard-step-map').click()
    await setColumnSplit(page, 2, ';')
    await page.getByTestId('wizard-next').click()

    expect(await statValue(page, 'values')).toBe(before + 1)
  })

  test('I23: the destination picker sets a parent and the clear button removes it', async ({
    page,
  }) => {
    await loadAndMap(page, 'flat.csv')
    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('map-destination-clear')).toHaveCount(0)

    await page.getByTestId('map-destination').click()
    const option = page.locator('[data-testid^="object-option-"]').first()
    await expect(option).toBeVisible()
    await option.click()

    await expect(page.getByTestId('map-destination-clear')).toBeVisible()
    await page.getByTestId('map-destination-clear').click()
    await expect(page.getByTestId('map-destination-clear')).toHaveCount(0)
  })

  test('I24: a blocked Continue always states its reason', async ({ page }) => {
    await loadAndMap(page, 'noname.csv')

    await expect(page.getByTestId('wizard-next')).toBeDisabled()
    await expect(page.getByTestId('wizard-blocked')).toContainText(
      'Map a column to Name'
    )
  })

  test('I25: too many objects names both numbers', async ({ page }) => {
    const { maxObjects } = await importLimits(page)
    expect(
      maxObjects,
      'run the e2e server with MAX_OBJECTS_PER_IMPORT=200 — huge.csv is 250 rows'
    ).toBeLessThan(250)

    await loadAndMap(page, 'huge.csv')

    await expect(page.getByTestId('wizard-blocked')).toContainText(
      `That is 250 objects — the limit is ${maxObjects}`
    )
    await expect(page.getByTestId('wizard-next')).toBeDisabled()
  })

  test('I26: a mapping that builds nothing says so', async ({ page }) => {
    await loadAndMap(page, 'empty-data.csv')

    await expect(page.getByTestId('wizard-blocked')).toContainText(
      'This mapping would create nothing'
    )
  })

  test('I27: the Sheet step is never blocked by a name it cannot know about', async ({
    page,
  }) => {
    await loadSheet(page, 'noname.csv')

    await expect(page.getByTestId('wizard-blocked')).toHaveCount(0)
    await expect(page.getByTestId('wizard-next')).toBeEnabled()
  })
})
