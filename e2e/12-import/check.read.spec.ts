import { expect, test } from '../fixtures/app'
import { loadAndMap, openWizard, statValue } from '../utils/import'

/** The last reversible screen: the node's store is append-only, so nothing after this undoes. */

test.describe('12 - import / check', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page)
  })

  test('I35: four stat tiles', async ({ page }) => {
    await loadAndMap(page, 'flat.csv')
    await page.getByTestId('wizard-next').click()

    for (const id of ['objects', 'depth', 'values', 'problems']) {
      await expect(page.getByTestId(`check-stat-${id}`)).toBeVisible()
    }
    expect(await statValue(page, 'objects')).toBe(5)
    expect(await statValue(page, 'depth')).toBe(1)
    expect(await statValue(page, 'problems')).toBe(0)
  })

  test('I36: with a hierarchy the object count is not the row count', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()
    await page.getByTestId('wizard-next').click()

    expect(await statValue(page, 'objects')).toBe(6)
    await expect(page.getByTestId('check-stat-objects')).toContainText(
      'from 4 rows'
    )
  })

  test('I37: preview rows carry the depth the level columns describe', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-level-2').click()
    await page.getByTestId('map-level-0').click()
    await page.getByTestId('map-level-1').click()
    await page.getByTestId('wizard-next').click()

    // Marked in the order Ruimte, Gebouw, Verdieping — the order IS the nesting, so the deepest
    // level is Verdieping and the outermost is Ruimte.
    expect(await statValue(page, 'depth')).toBe(3)
    await expect(
      page.locator('[data-testid^="check-row-"][data-depth="0"]')
    ).toHaveCount(4)
    await expect(
      page.locator('[data-testid^="check-row-"][data-depth="2"]')
    ).toHaveCount(4)
  })

  test('I38: a refused row is named by its line in the FILE', async ({
    page,
  }) => {
    await loadAndMap(page, 'problems.csv')
    await page.getByTestId('wizard-next').click()

    expect(await statValue(page, 'objects')).toBe(2)
    expect(await statValue(page, 'problems')).toBe(1)
    // The blank row is the second of three, but line SIX of the file. The node never sees the
    // spreadsheet, so this screen is the only place that number exists.
    await expect(page.getByTestId('check-problems')).toContainText(
      'Row 6: Name is blank'
    )
  })

  test('I39: a long sheet says how much of it is on screen', async ({
    page,
  }) => {
    await loadAndMap(page, 'many.csv')
    await page.getByTestId('wizard-next').click()

    expect(await statValue(page, 'objects')).toBe(60)
    await expect(page.locator('[data-testid^="check-row-"]')).toHaveCount(40)
    await expect(page.getByTestId('check-showing-first')).toContainText(
      'Showing the first 40 of 60 objects.'
    )
  })

  test('I40: the Import button’s count equals the objects tile', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()
    await page.getByTestId('wizard-next').click()

    const objects = await statValue(page, 'objects')
    // Check's own button only navigates, so it says Continue. The count belongs to the button that
    // writes, one step on.
    await expect(page.getByTestId('wizard-next')).toContainText('Continue')
    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('run-start')).toContainText(String(objects))
  })
})
