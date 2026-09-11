import type { Locator, Page } from '@playwright/test'

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

async function openCreateSheet(page: Page) {
  await tour(page, 'rollupRulesCreate').click()
  const key = page.getByTestId('rollup-rule-property-key')
  await expect(key).toBeVisible()
  return key
}

/** Create one rule and return its row. Every caller deletes it again — a rule is a running cost. */
async function createRule(page: Page, key: string): Promise<Locator> {
  const input = await openCreateSheet(page)
  await input.fill(key)
  await page.getByTestId('rollup-rule-add-key').click()
  await page.getByTestId('rollup-rule-submit').click()
  const row = page.getByTestId('data-table-row').filter({ hasText: key })
  await expect(row).toHaveCount(1, { timeout: 15_000 })
  return row
}

async function deleteRule(page: Page, row: Locator) {
  const actions = rowActions(page, 'rollup-rule', row)
  // The caller may have left the menu open. Re-clicking the trigger would then TOGGLE it shut, and
  // pressing Escape and clicking straight away lands the click during the exit animation, which
  // Radix swallows. So: use the open menu if it is already showing what we need, and otherwise
  // wait for it to be gone before opening it again.
  if (!(await actions.action('delete').isVisible())) {
    await page.keyboard.press('Escape')
    await expect(actions.action('delete')).toHaveCount(0)
    await actions.menu.click()
  }
  await expect(actions.action('delete')).toBeVisible()
  await actions.action('delete').click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^delete$/i })
    .click()
  await expect(row).toHaveCount(0, { timeout: 15_000 })
  // Wait for the dialog to be GONE, not merely for the row to vanish. Radix locks pointer events
  // on the body while a modal is mounted and releases them on exit; a click issued in that window
  // succeeds silently and does nothing, so the NEXT test opens no sheet and fails somewhere
  // unrelated. Passing alone and failing in sequence is the signature.
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
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

  test('RR7: a rule offers edit and recompute, but never share', async ({
    page,
  }) => {
    // Creates its own row rather than taking `.first()`: on a node with seeded system rules the
    // first row is one of those, and a system rule has NO menu at all.
    const unique = stamp()
    const row = await createRule(page, unique)

    const actions = rowActions(page, 'rollup-rule', row)
    await actions.menu.click()

    // Edit reaches exactly one field, `multiplyBy`. `propertyKey` and `aggregation` stay immutable
    // — every state row pins the ruleId — so changing a key is still delete-then-create.
    await expect(actions.action('edit')).toHaveCount(1)
    await expect(actions.action('recompute')).toHaveCount(1)
    // Sharing has no route at all: a rule is the node's or yours, and another account's 404s.
    await expect(actions.action('share')).toHaveCount(0)

    await deleteRule(page, row)
  })

  test('RR4: a created rule lists, and can be deleted again', async ({
    page,
  }) => {
    // Removing it again keeps the node-wide rule cap where this test found it.
    const row = await createRule(page, stamp())
    await deleteRule(page, row)
  })

  test('RR8: a rule can name the property it counts by', async ({ page }) => {
    const unique = stamp()
    const input = await openCreateSheet(page)

    await input.fill(unique)
    await page.getByTestId('rollup-rule-add-key').click()

    // The multiplier is normalized exactly like the rolled-up key: a rule matches the node's index
    // on an EXACT key, so "Quantity" typed here has to become what the property field stores.
    const multiplier = page.getByTestId('rollup-rule-multiply-by')
    await multiplier.fill('Quantity')
    await expect(page.getByText(/saved as quantity/i)).toBeVisible()

    await page.getByTestId('rollup-rule-submit').click()
    const row = page.getByTestId('data-table-row').filter({ hasText: unique })
    await expect(row).toHaveCount(1, { timeout: 15_000 })

    // The view sheet states the multiplier — otherwise a rule that scales looks identical to one
    // that does not, and the totals are the only clue.
    await row.click()
    await expect(page.getByText(/counted by/i)).toBeVisible()
    await page.keyboard.press('Escape')

    await deleteRule(page, row)
  })

  test('RR9: a rule cannot count by a key it is queued to total', async ({
    page,
  }) => {
    const unique = stamp()
    const input = await openCreateSheet(page)

    await input.fill(unique)
    await page.getByTestId('rollup-rule-add-key').click()

    // The node 422s a rule multiplying by its own key. With ONE multiplier over N queued keys that
    // rejects exactly one create while the rest succeed, and the partial-failure toast cannot name
    // the chip — so the form blocks the submit instead.
    await page.getByTestId('rollup-rule-multiply-by').fill(unique)
    await expect(
      page.getByTestId('rollup-rule-multiply-by-collision')
    ).toBeVisible()
    await expect(page.getByTestId('rollup-rule-submit')).toBeDisabled()

    // Naming a different key releases it, so the block is the collision and not the field itself.
    await page.getByTestId('rollup-rule-multiply-by').fill('quantity')
    await expect(
      page.getByTestId('rollup-rule-multiply-by-collision')
    ).toHaveCount(0)
    await expect(page.getByTestId('rollup-rule-submit')).toBeEnabled()
  })

  test('RR10: the multiplier is the one field an edit may change', async ({
    page,
  }) => {
    const unique = stamp()
    const row = await createRule(page, unique)

    const actions = rowActions(page, 'rollup-rule', row)
    await actions.menu.click()
    await actions.action('edit').click()

    const field = page.getByTestId('rollup-rule-edit-multiply-by')
    await expect(field).toBeVisible()
    // Nothing changed yet, so there is nothing to save. A PATCH that changes nothing would still
    // re-arm every entity holding the key and make the node recompute a subtree for no reason.
    await expect(page.getByTestId('rollup-rule-edit-submit')).toBeDisabled()

    await field.fill('quantity')
    await expect(page.getByTestId('rollup-rule-edit-submit')).toBeEnabled()
    await page.getByTestId('rollup-rule-edit-submit').click()

    // Reopening proves the change reached the node rather than only the form's state.
    await expect(page.getByTestId('rollup-rule-edit-multiply-by')).toHaveCount(
      0
    )
    await row.click()
    await expect(page.getByText(/counted by/i)).toBeVisible()
    await page.keyboard.press('Escape')

    await deleteRule(page, row)
  })

  test('RR11: an edit cannot point the multiplier at the rule’s own key', async ({
    page,
  }) => {
    const unique = stamp()
    const row = await createRule(page, unique)

    const actions = rowActions(page, 'rollup-rule', row)
    await actions.menu.click()
    await actions.action('edit').click()

    await page.getByTestId('rollup-rule-edit-multiply-by').fill(unique)
    await expect(page.getByTestId('rollup-rule-edit-collision')).toBeVisible()
    await expect(page.getByTestId('rollup-rule-edit-submit')).toBeDisabled()

    await page.getByRole('button', { name: /cancel/i }).click()
    await deleteRule(page, row)
  })

  test('RR12: recompute answers, and answers again on a second press', async ({
    page,
  }) => {
    // The node keeps completed jobs, so a deterministic job id would have made the SECOND press a
    // silent no-op — the whole point of the button. This asserts the endpoint stays reachable.
    const unique = stamp()
    const row = await createRule(page, unique)

    for (const attempt of [1, 2]) {
      const actions = rowActions(page, 'rollup-rule', row)
      await actions.menu.click()
      await actions.action('recompute').click()
      await expect(
        page.getByText(/recalculation queued/i),
        `press ${attempt} was accepted`
      ).toBeVisible({ timeout: 15_000 })
      // The toast is the only signal; let it clear so the next press asserts its own.
      await page.waitForTimeout(4_000)
    }

    await deleteRule(page, row)
  })
})
