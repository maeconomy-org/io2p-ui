import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { loadAndMap, openWizard, setColumnTarget } from '../utils/import'

/**
 * Where an address column LANDS in a hierarchy.
 *
 * A Building/Floor/Room sheet used to give every room an address and no building one, so a search
 * for a street found the rooms and not the building anyone would look for. `ATTACH_EVERY_LEVEL`
 * (`-1`) writes it to every object on the row's path instead, and the Map step gained a third
 * option for it.
 *
 * `.read.`: the wizard stages nothing until Import, and no case here reaches that step.
 *
 * The row's `data-has-address` attribute is what is asserted, not the Yes badge — the badge is
 * `common.yes` and would read nothing the moment the account is in Dutch.
 */

const LEVEL_COLUMNS = [0, 1]
const NAME_COLUMN = 2
const ADDRESS_COLUMN = 3

/** Levels first: the attach control only renders once the sheet HAS levels to attach to. */
async function mapLevelsAndAddress(page: Page): Promise<void> {
  await loadAndMap(page, 'levels-address.csv')
  for (const column of LEVEL_COLUMNS) {
    await page.getByTestId(`map-level-${column}`).click()
    await expect(page.getByTestId(`map-level-${column}`)).toHaveAttribute(
      'data-level',
      'true'
    )
  }
  await setColumnTarget(page, NAME_COLUMN, 'name')
  await setColumnTarget(page, ADDRESS_COLUMN, 'address')
}

async function setAttach(page: Page, option: string): Promise<void> {
  await page.getByTestId(`map-attach-${ADDRESS_COLUMN}`).click()
  await page.getByTestId(`map-attach-option-${option}`).click()
  await expect(page.getByTestId(`map-attach-option-${option}`)).toHaveCount(0)
}

const rows = (page: Page) => page.locator('[data-testid^="check-row-"]')

async function goToCheck(page: Page): Promise<void> {
  await page.getByTestId('wizard-next').click()
  await expect(rows(page).first()).toBeVisible()
}

test.describe('12 - import / check address', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page)
  })

  test('I65: attach-every gives EVERY object on the path an address', async ({
    page,
  }) => {
    await mapLevelsAndAddress(page)
    await setAttach(page, 'every')
    await goToCheck(page)

    // Counted off the fixture rather than written down: the object total is a product of the level
    // columns, and a hardcoded number turns a mapping change into an arithmetic puzzle.
    const total = await rows(page).count()
    expect(total).toBeGreaterThan(0)
    await expect(
      page.locator('[data-testid^="check-row-"][data-has-address="true"]')
    ).toHaveCount(total)
  })

  test('I66: attach-deepest gives it only to the leaves', async ({ page }) => {
    await mapLevelsAndAddress(page)
    await setAttach(page, 'deepest')
    await goToCheck(page)

    const total = await rows(page).count()
    const withAddress = page.locator(
      '[data-testid^="check-row-"][data-has-address="true"]'
    )

    // The inversion that stops I65 passing vacuously: if the attach choice did nothing, both cases
    // would report every row and the pair would agree for the wrong reason.
    const leaves = await withAddress.count()
    expect(leaves).toBeGreaterThan(0)
    expect(leaves).toBeLessThan(total)

    const depthOf = (locator: typeof withAddress) =>
      locator.evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute('data-depth')))
      )

    // Read off the rendered tree rather than counted from the level columns. The name column names
    // the deepest LEVEL object rather than adding one below it, so the maximum depth is a property
    // of the mapping and not of `LEVEL_COLUMNS.length`.
    const deepest = Math.max(...(await depthOf(rows(page))))
    const carrying = await depthOf(withAddress)
    expect(new Set(carrying).size, 'more than one depth carries it').toBe(1)
    expect(carrying[0]).toBe(deepest)
  })

  test('I67: accepting the SUGGESTED hierarchy seeds the attach the same way', async ({
    page,
  }) => {
    await loadAndMap(page, 'levels-address.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()

    await setColumnTarget(page, ADDRESS_COLUMN, 'address')

    // The prompt called the raw setter and skipped the seed entirely — the bug survived a unit test
    // that only covered the toggle, so the entry point is the case rather than the outcome.
    await expect(page.getByTestId(`map-attach-${ADDRESS_COLUMN}`)).toBeVisible()
    await setAttach(page, 'every')
    await goToCheck(page)

    // I65's assertion, not "some row has an address". Asserting the FIRST row with an address is
    // visible is true under `every` AND under `deepest` — so the case would have passed whether or
    // not the suggested path seeded the attach, which is the one thing its name claims to pin.
    const total = await rows(page).count()
    expect(total).toBeGreaterThan(0)
    await expect(
      page.locator('[data-testid^="check-row-"][data-has-address="true"]')
    ).toHaveCount(total)
  })
})
