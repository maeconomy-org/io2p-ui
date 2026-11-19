import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { setLanguage } from '../utils/language'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
} from '../utils/sheet'

/**
 * The Name field is a NAME, and a dictionary term reads in the viewer's language.
 *
 * Both halves regressed silently and neither had e2e cover. `resolvePropertyLabel` kept passing its
 * own unit tests while no row called it, so a Dutch reader saw an English colleague's `weight` as
 * "Weight" — the cross-language convergence the dictionary exists to provide. The other half stored
 * the kebab KEY in the field labelled Name, so picking a suggestion renamed the property to
 * `gross-floor-area` in front of the user.
 *
 * A write spec: it creates objects, and PD2 changes the account language.
 */

/** One of the 21 terms added for the real asset registers, so PD4 pins that batch specifically. */
const TERM = {
  key: 'gross-floor-area',
  typed: 'Gross Floor',
  en: 'Gross Floor Area',
  nl: 'Bruto Vloeroppervlak',
} as const

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.locator('tr').filter({ hasText: name }).first()
}

/** Type enough to match, then ACCEPT the suggestion — the accept is what sets the stable key. */
async function pickTerm(page: Page, index: number): Promise<void> {
  await page.getByTestId(`property-name-${index}`).fill(TERM.typed)
  await page.getByTestId(`property-name-suggestion-${TERM.key}`).click()
}

async function seedWithTerm(page: Page, tag: string): Promise<string> {
  const name = `${stamp()}-${tag}`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await pickTerm(page, 0)
  await page.getByTestId('property-value-0-0').fill('610 m2')
  await saveSheet(page)
  await expect(panel).toBeHidden()
  return name
}

test.describe('03 - object sheet / property dictionary', () => {
  // `openCreateSheet` clicks a header button on whatever page is loaded; it does not navigate. The
  // first test in a file owes its own goto or it clicks into `about:blank`.
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('PD1: picking a dictionary term shows the NAME, not the stored key', async ({
    page,
  }) => {
    const name = await seedWithTerm(page, 'pd1')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    const field = page.getByTestId('property-name-0')
    await expect(field).toHaveValue(TERM.en)
    // The negative is the whole point: the field held `gross-floor-area` before the fix, and a
    // positive-only assertion passes on a build that shows the key beside the name.
    await expect(field).not.toHaveValue(TERM.key)
  })

  test('PD2: the same property reads in the viewer own language', async ({
    page,
  }) => {
    const name = await seedWithTerm(page, 'pd2')

    await setLanguage(page, 'nl')
    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    // The stored label never moves — only the render does. So this is the Dutch label for a
    // property authored in English, which is the convergence the dictionary is for.
    await expect(page.getByTestId('property-name-0')).toHaveValue(TERM.nl)
  })

  test('PD3: a stored key is locked and says which key it kept', async ({
    page,
  }) => {
    const name = await seedWithTerm(page, 'pd3')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    await page.getByTestId('property-name-0').fill('Something else entirely')

    // Renaming a committed property sends the new LABEL and keeps the key. Unwarned, two properties
    // read alike in the sheet while totalling under different rollup keys.
    const notice = page.getByTestId('property-key-locked-0')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(TERM.key)
  })

  test('PD4: a term from the asset-register batch is offered by the suggester', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(`${stamp()}-pd4`)
    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill(TERM.typed)

    const list = page.getByTestId('property-name-suggestions')
    await expect(list).toBeVisible()
    await expect(
      list.getByTestId(`property-name-suggestion-${TERM.key}`)
    ).toContainText(TERM.en)
  })

  /**
   * `afterEach`, not `afterAll`. PD2 leaves the account in Dutch, and PD4 asserts on the ENGLISH
   * dictionary label — an `afterAll` restores too late and PD4 reads `Bruto Vloeroppervlak`. It is
   * cheap to repeat: `setLanguage` returns immediately when the language is already the one asked
   * for.
   *
   * Unconditional, and to a known value. An inline reset only runs when the test passes, and the
   * run where it matters is the run where PD2 failed — which then hands Dutch to every later spec.
   */
  test.afterEach(async ({ page }) => {
    await setLanguage(page, 'en')
  })
})
