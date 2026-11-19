import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { rowActions, tour } from '../utils/selectors'
import { addProperty, openCreateSheet, openDialog } from '../utils/sheet'

/**
 * Correcting a formula, and what a value bound to the old one is told.
 *
 * A superseded formula STILL BINDS — the node treats the status as a signal for clients to
 * surface, never as a gate — so the only thing standing between a user and a formula its author
 * has declared wrong is this warning. And the correction link is a one-click DESTRUCTIVE rebind:
 * `onChange({ formulaId: supersededBy, args: [] })` clears every binding the user had made.
 */

const stamp = () => `e2e-${Date.now()}`
const runId = Date.now()
const ORIGINAL = `${runId}-sup-orig`
const CORRECTION = `${runId}-sup-fix`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

async function createFormula(page: Page, name: string, expression: string) {
  await page.goto('/formulas')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'formulasCreate').click()
  const dialog = await openDialog(page)
  await dialog.getByLabel(/name/i).first().fill(name)
  await dialog.getByLabel(/expression/i).fill(expression)
  await page.getByTestId('formula-submit').click()
  await expect(rowFor(page, name)).toHaveCount(1)
}

test.describe('03 - object sheet / a superseded formula', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()

    await createFormula(page, ORIGINAL, 'a * 2')

    // Correct is a CLAIM that the original is wrong: the node stamps `supersededBy` on it and the
    // two rows plus the pending op ride one accept transaction, so there is no window where the
    // correction exists unmarked.
    const row = rowFor(page, ORIGINAL)
    const actions = rowActions(page, 'formula', row)
    await actions.menu.click()
    await actions.action('correct').click()

    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(CORRECTION)
    await dialog.getByLabel(/expression/i).fill('a * 3')
    await page.getByTestId('formula-submit').click()
    await expect(rowFor(page, CORRECTION)).toHaveCount(1)

    await page.close()
  })

  test('FS1: the original is marked superseded and offers no second correction', async ({
    page,
  }) => {
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table')).toBeVisible()

    const row = rowFor(page, ORIGINAL)
    const actions = rowActions(page, 'formula', row)
    await actions.menu.click()

    // The pointer is last-write-wins, so a second correction would silently drop the first and
    // leave two claims with no way to see either.
    await expect(actions.action('correct')).toHaveCount(0)
    // The successor is still correctable — the guard is about being superseded, not about lineage.
    await page.keyboard.press('Escape')
    const fix = rowActions(page, 'formula', rowFor(page, CORRECTION))
    await fix.menu.click()
    await expect(fix.action('correct')).toBeVisible()
  })

  test('FS2: binding the superseded formula warns, and the link swaps it', async ({
    page,
  }) => {
    const name = `${stamp()}-fs2`
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('total')
    await page.getByTestId('value-mode-0-0').click()
    await expect(page.getByTestId('value-mode-0-0')).toHaveAttribute(
      'data-mode',
      'formula'
    )

    // A superseded formula is still OFFERED. The node lets it bind, so hiding it here would
    // silently break every object that already uses one.
    await page.getByTestId('formula-select').click()
    await page.getByTestId(`formula-option-${ORIGINAL}`).click()
    await expect(page.getByTestId('formula-superseded')).toBeVisible()

    // One click rebinds to the successor. Destructive by design — `args: []` drops every binding
    // the user had made, which is why the warning names it rather than swapping silently.
    await page.getByTestId('formula-use-correction').click()
    await expect(page.getByTestId('formula-superseded')).toHaveCount(0)
    await expect(page.getByTestId('formula-select')).toContainText(CORRECTION)
  })

  test('FS3: the correction carries no warning of its own', async ({
    page,
  }) => {
    const name = `${stamp()}-fs3`
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('total')
    await page.getByTestId('value-mode-0-0').click()
    await page.getByTestId('formula-select').click()
    await page.getByTestId(`formula-option-${CORRECTION}`).click()

    // The inversion guard for FS2: without this, that test would pass against a build that showed
    // the warning on every formula.
    await expect(page.getByTestId('formula-superseded')).toHaveCount(0)
  })
})
