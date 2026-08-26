import { expect, test } from '../fixtures/app'
import { rowActions, tour } from '../utils/selectors'

/**
 * The rules page had one smoke test — `00-harness/hydration.read.spec.ts` reaches `/rollup-rules`
 * only because its route list is derived from `NAV_ITEMS`, and asserts the page renders. Nothing
 * covered what it does.
 *
 * A rule is a RUNNING COST, not a catalogue entry: every rule is computed for every entity of
 * every user and consumes the node-wide cap that gates user rule creation. So each test here
 * removes what it created.
 */

const stamp = () => `e2e${Date.now()}`

async function openCreateSheet(page: import('@playwright/test').Page) {
  await tour(page, 'rollupRulesCreate').click()
  const key = page.getByTestId('rollup-rule-property-key')
  await expect(key).toBeVisible()
  return key
}

test.describe('16 - rollups / rules', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('RR1: a queued key is normalized before it is saved', async ({
    page,
  }) => {
    const key = await openCreateSheet(page)

    // Mixed case on purpose: `search.k` is `key.toLowerCase()` and a rule matches it EXACTLY, so a
    // rule stored as typed would match nothing this UI ever wrote.
    await key.fill('Mass')
    await expect(page.getByText(/saved as mass/i)).toBeVisible()

    await page.getByTestId('rollup-rule-add-key').click()
    await expect(page.getByTestId('rollup-rule-queued-keys')).toContainText(
      'mass'
    )
  })

  test('RR2: a key the dictionary calls text warns without blocking', async ({
    page,
  }) => {
    const key = await openCreateSheet(page)

    // `supplier` is in the non-numeric set. The warning is advisory by design — the node accepts
    // the rule, and a key the dictionary calls text can still hold numbers in practice.
    await key.fill('supplier')
    await expect(
      page.getByTestId('rollup-rule-non-numeric-warning')
    ).toBeVisible()
    await expect(page.getByTestId('rollup-rule-add-key')).toBeEnabled()
  })

  test('RR3: the same key cannot be queued twice', async ({ page }) => {
    const key = await openCreateSheet(page)
    const unique = stamp()

    await key.fill(unique)
    await page.getByTestId('rollup-rule-add-key').click()
    await expect(page.getByTestId('rollup-rule-queued-keys')).toContainText(
      unique
    )

    await key.fill(unique)
    await expect(page.getByText(/already in the list/i)).toBeVisible()
    await expect(page.getByTestId('rollup-rule-add-key')).toBeDisabled()
  })

  test('RR4: a created rule lists, and can be deleted again', async ({
    page,
  }) => {
    const unique = stamp()
    const key = await openCreateSheet(page)

    await key.fill(unique)
    await page.getByTestId('rollup-rule-add-key').click()
    await page.getByTestId('rollup-rule-submit').click()

    const row = page.getByTestId('data-table-row').filter({ hasText: unique })
    await expect(row).toHaveCount(1)

    // Removing it again keeps the node-wide rule cap where this test found it.
    const actions = rowActions(page, 'rollup-rule', row)
    await actions.menu.click()
    await actions.action('delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^delete$/i })
      .click()
    await expect(row).toHaveCount(0)
  })
})
