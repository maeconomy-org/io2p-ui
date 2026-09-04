import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  gotoList,
  openCreateSheet,
  openDialog,
  openObjectSheet,
  saveSheet,
} from '../utils/sheet'

/**
 * The two small marks beside a value, and the rename that had no case at all.
 *
 * `ValueNormalization` renders at most one marker and the two mean opposite things. The canonical
 * chip is informational — the server parsed `2 t` and stores `2000 kg`, and showing the stored form
 * is the only way a reader can tell what a rollup will actually add up. The excluded warning is a
 * defect report: a value some formula BINDS no longer parses, so the recipe is quietly computing
 * without it.
 *
 * Which one appears is read off `data-marker`, not off colour or prose. Both are translated, and the
 * pair is exactly the case where a wrong marker still looks right.
 *
 * Deliberately NOT here, because they already exist under other IDs: P13 is `PVAL5`, P15 is
 * `PV1`/`PV2`, and P14 is `PD2` in `property-dictionary.spec.ts`.
 */

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

/** One object, one property, saved — the shape every case here starts from. */
async function seed(
  page: Page,
  tag: string,
  property: string,
  value: string
): Promise<string> {
  const name = `${stamp()}-${tag}`
  await gotoList(page, '/objects')
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, property, value)
  await saveSheet(page)
  await expect(panel).toBeHidden()
  return name
}

const marker = (page: Page) => page.getByTestId('value-normalization')

/**
 * The layout toggle is driven through ARIA, not a testid — `property-views.spec.ts` rejects a
 * parallel testid there as a second source of truth, and this follows it rather than compete.
 */
const layout = (page: Page, name: RegExp) => page.getByRole('button', { name })
const DETAILED = /detailed view/i
const GRID = /grid overview/i

test.describe('03 - object sheet / value markers', () => {
  test('P2: renaming a property persists', async ({ page }) => {
    // A FREE-TEXT name on purpose. A dictionary key renders through
    // `resolvePropertyLabel`, so the dictionary's own label always wins and a rename is stored but
    // never shown — `Material` would come back as "Material" however it was renamed. That is the
    // cross-language convergence the dictionary is for, and it makes a dictionary term the wrong
    // subject for this case.
    const name = await seed(page, 'p2', 'Cladding note', 'north face')
    const renamed = 'Cladding remark'

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-name-0').fill(renamed)
    await saveSheet(page, { expectClose: false })

    // Reopened from the server, not re-read from the form that typed it. P3 pins the same round
    // trip for a VALUE; the name had no case, and it travels by a different field on the diff.
    await page.reload()
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-name-0')).toHaveValue(renamed)
  })

  test('P17: a value stores in its canonical unit, and says so', async ({
    page,
  }) => {
    // `2 t`, not `12 kg`: the marker renders only when the stored form DIFFERS from what was typed,
    // and `12 kg` is already canonical, so it would prove nothing. The node normalizes tonnes to
    // kilograms, which is exactly the conversion a reader cannot otherwise see.
    const name = await seed(page, 'p17', 'Weight', '2 t')

    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)

    const chip = marker(page)
    await expect(chip).toHaveAttribute('data-marker', 'canonical')
    // The number the ROLLUP will add, in the unit it will add it in. A chip that echoed `2 t` back
    // would be decoration.
    await expect(chip).toHaveAttribute('aria-label', /kg/)
  })

  test('P18: a bound value that stops parsing is marked as excluded', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-double`

    await gotoList(page, '/formulas')
    await tour(page, 'formulasCreate').click()
    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(formulaName)
    await dialog.getByLabel(/expression/i).fill('x * 2')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()
    await expect(rowFor(page, formulaName)).toHaveCount(1)

    const name = `${tag}-p18`
    await gotoList(page, '/objects')
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Width', '10')
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Doubled')
    await page.getByTestId('value-mode-1-0').click()
    await page.getByTestId('formula-select').click()
    await page.getByTestId(`formula-option-${formulaName}`).click()
    await page.getByTestId('formula-bind-x').click()
    await page
      .locator('[data-state="open"][role="dialog"]')
      .last()
      .getByTestId(siblingTestId('Width'))
      .click()

    // A third property that is unparseable and bound to NOTHING — the control for the claim that
    // this warning is about being USED. Free text on purpose: a serial number never parses, and
    // that is not a mistake.
    await addProperty(page, 2)
    await fillProperty(page, 2, 'Serial', 'not a number either')
    await saveSheet(page)
    await expect(panel).toBeHidden()

    // Text cannot be BOUND in the first place — F6 pins that a text sibling is not offered — so the
    // only way to reach this state is to break a binding that was valid when it was made. Which is
    // the point: the warning is about being USED, never about failing to parse. A barcode that
    // never parses is not a mistake, and flagging it would put a warning on half the properties.
    //
    // It has to be a SAVED object: `usedInFormula` is `!!value.id && bound.has(value.id)`, and a
    // draft value has no id, so the marker cannot render in a create sheet however the binding is
    // made.
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    // Resolved from the COLLAPSED headers. Rows come back in the server's order rather than the
    // order they were typed, so an index cannot be assumed — and the name input cannot be read
    // either, because Radix unmounts a collapsed row's body. While everything is still collapsed
    // only the source row carries the word, since the derived row's binding chips are in the body
    // it has not mounted yet.
    const widthRow = page
      .locator('[data-testid^="property-row-"]')
      .filter({ hasText: 'Width' })
    await expect(widthRow).toHaveCount(1)
    const index = Number(
      (await widthRow.getAttribute('data-testid'))!.split('-').pop()
    )

    await page.getByTestId(`property-toggle-${index}`).click()
    await page.getByTestId(`property-value-${index}-0`).fill('not a number')

    // Saved, then reopened. `parse` is the SERVER's answer, so a value that has only been typed
    // still carries the parse of the value it replaced — the marker cannot change until the node
    // has seen the new one.
    await saveSheet(page, { expectClose: false })
    await page.reload()
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    const broken = page
      .locator('[data-testid^="property-row-"]')
      .filter({ hasText: 'Width' })
    await expect(broken).toHaveCount(1)
    const after = Number(
      (await broken.getAttribute('data-testid'))!.split('-').pop()
    )
    await page.getByTestId(`property-toggle-${after}`).click()

    await expect(
      page
        .getByTestId(`property-row-${after}`)
        .getByTestId('value-normalization')
    ).toHaveAttribute('data-marker', 'excluded')

    // THE CONTROL THIS CASE'S OWN ARGUMENT NEEDS. Everything above proves
    // bound + unparseable => excluded, and says nothing about unbound + unparseable — while the
    // comment claims the warning is about being USED, and that flagging every unparseable value
    // would put a warning on half the properties. Delete the `usedInFormula` check in the product
    // and every assertion above still passes. This is the half that fails.
    const loose = page
      .locator('[data-testid^="property-row-"]')
      .filter({ hasText: 'Serial' })
    await expect(loose).toHaveCount(1)
    const looseIndex = Number(
      (await loose.getAttribute('data-testid'))!.split('-').pop()
    )
    await page.getByTestId(`property-toggle-${looseIndex}`).click()
    // Anchored: the row is open and holds the unparseable value, so the missing marker is an
    // absence observed where it COULD have appeared rather than a free pass.
    await expect(
      page.getByTestId(`property-value-${looseIndex}-0`)
    ).toHaveValue('not a number either')
    await expect(
      page
        .getByTestId(`property-row-${looseIndex}`)
        .getByTestId('value-normalization')
    ).toHaveCount(0)
  })

  test('P16b: the read layout follows you to another object', async ({
    page,
  }) => {
    const first = await seed(page, 'p16a', 'Material', 'concrete')
    const second = await seed(page, 'p16b', 'Material', 'steel')

    await gotoList(page, '/objects')
    await openObjectSheet(page, rowFor(page, first))
    await layout(page, GRID).click()
    await expect(layout(page, GRID)).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')

    // PV3 pins that the choice survives a RELOAD. This is the other half: it is an ACCOUNT
    // preference, so it is not a property of the sheet that set it.
    await openObjectSheet(page, rowFor(page, second))
    await expect(layout(page, GRID)).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * The layout is an ACCOUNT preference, so it outlives the run and every later spec reads it.
   * `PV7` exists solely to put it back; this file owes the same, unconditionally and in a hook
   * rather than on the happy path.
   */
  test.afterEach(async ({ page }) => {
    await gotoList(page, '/objects')
    await openObjectSheet(page, page.getByTestId('data-table-row').first())

    // UNCONDITIONALLY, under `toPass`. The earlier version read `aria-pressed` ONCE and clicked only
    // if it disagreed — which is the guard measured and reverted in `selectView`: pre-hydration that
    // attribute comes from the first-paint cookie, which can disagree with the account, so a restore
    // could return having clicked nothing and hand a grid layout to every later spec. The layouts
    // are radio-like, so a redundant click costs nothing and this cannot skip the work.
    await expect(async () => {
      await layout(page, DETAILED).click()
      await expect(layout(page, DETAILED)).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 30_000 })

    await page.keyboard.press('Escape')
  })
})
