import { expect, test } from '../fixtures/app'
import { loadAndMap, openWizard, statValue } from '../utils/import'

/**
 * The suggester is OPT-IN, and that is the test. Volunteered, it fired on ten of sixteen sheets of
 * a real asset register and was wrong every time — so a spec asserting it fires on load would
 * re-encode the reversed bug.
 */

test.describe('12 - import / hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page)
  })

  test('I28: nothing is proposed until Suggest is clicked', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')

    await expect(page.getByTestId('map-suggest')).toBeVisible()
    await expect(page.getByTestId('map-suggest-effect')).toHaveCount(0)
    await expect(page.getByTestId('map-suggest-accept')).toHaveCount(0)
    await expect(page.getByTestId('map-level-summary')).toHaveCount(0)
    await expect(page.getByTestId('map-level-0')).toHaveAttribute(
      'data-level',
      'false'
    )
  })

  test('I29: the proposal names the columns and states what it would produce', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()

    await expect(page.getByTestId('map-suggest-accept')).toBeVisible()
    await expect(page.getByTestId('map-suggest-effect')).toContainText(
      'create 6 objects from 4 rows'
    )
  })

  test('I30: accepting orders the level badges, and Check agrees', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()

    await expect(page.getByTestId('map-level-0')).toHaveAttribute(
      'data-level',
      'true'
    )
    await expect(page.getByTestId('map-level-1')).toHaveAttribute(
      'data-level',
      'true'
    )
    await expect(page.getByTestId('map-column-0')).toContainText('Level 1')
    await expect(page.getByTestId('map-column-1')).toContainText('Level 2')
    await expect(page.getByTestId('map-level-summary')).toContainText(
      '4 rows become 6 objects'
    )

    await page.getByTestId('wizard-next').click()
    expect(await statValue(page, 'objects')).toBe(6)
  })

  test('I31: a flat sheet answers "none found" and offers no dead Accept', async ({
    page,
  }) => {
    await loadAndMap(page, 'flat.csv')
    await page.getByTestId('map-suggest').click()

    await expect(page.getByTestId('map-suggest-none')).toBeVisible()
    await expect(page.getByTestId('map-suggest-accept')).toHaveCount(0)
  })

  test('I32: clearing the hierarchy reverts to a row per object', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()
    await expect(page.getByTestId('map-level-summary')).toBeVisible()

    await page.getByTestId('map-clear-levels').click()

    await expect(page.getByTestId('map-level-summary')).toHaveCount(0)
    // Without levels this sheet has no name column, so it blocks — which is itself the revert.
    await expect(page.getByTestId('wizard-blocked')).toContainText(
      'Map a column to Name'
    )
  })

  test('I33: attach-to appears only once levels exist, and never on a level column', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await expect(page.getByTestId('map-attach-3')).toHaveCount(0)

    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()

    await expect(page.getByTestId('map-attach-3')).toBeVisible()
    await expect(page.getByTestId('map-attach-0')).toHaveCount(0)
    await expect(page.getByTestId('map-attach-1')).toHaveCount(0)
  })

  test('I34: a property attached to level 1 lands on the parent, not the leaf', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()

    const buildings = page.locator(
      '[data-testid^="check-row-"][data-depth="0"]'
    )
    const floors = page.locator('[data-testid^="check-row-"][data-depth="1"]')
    /** The properties cell — the second column of the Check preview. */
    const properties = (row: typeof buildings) =>
      row.first().locator('td').nth(1)

    await page.getByTestId('wizard-next').click()
    await expect(buildings).toHaveCount(2)
    await expect(floors).toHaveCount(4)
    await expect(properties(buildings)).toHaveText('—')
    await expect(properties(floors)).toContainText('2')

    await page.getByTestId('wizard-step-map').click()
    await page.getByTestId('map-attach-3').click()
    await page.getByTestId('map-attach-option-0').click()
    await page.getByTestId('wizard-next').click()

    // Oppervlakte moved up to the building; the floor keeps only Ruimte.
    await expect(properties(buildings)).toContainText('1')
    await expect(properties(floors)).toContainText('1')
  })
})
