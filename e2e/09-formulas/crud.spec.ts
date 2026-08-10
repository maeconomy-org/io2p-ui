import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * §6.12 FM1-FM5 — formulas.
 *
 * The validity indicator is asserted through `aria-invalid`, not a colour and not a testid. It is
 * already on the input, it says the same thing to a screen reader, and it survives the production
 * build's `data-testid` strip (§4.9).
 */

const stamp = () => `e2e-${Date.now()}`

test.describe('09 - formulas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('FM1/FM2: the indicator uses the server grammar, including ^', async ({
    page,
  }) => {
    await tour(page, 'formulasCreate').click()

    const expression = page.getByLabel(/expression/i)
    await expect(expression).toBeVisible()

    // Parsed by the SAME expr-eval the node uses, so "valid" here means the create will not 422.
    // `^` is the case that regressed: a hand-rolled validator rejected it while the server
    // accepted it, so the form refused a formula that was fine.
    await expression.fill('a ^ 2 + b')
    await expect(expression).toHaveAttribute('aria-invalid', 'false')

    await expression.fill('a +* b')
    await expect(expression).toHaveAttribute('aria-invalid', 'true')
  })

  test('FM3: a formula row offers Duplicate and never Edit', async ({
    page,
  }) => {
    const row = page.getByTestId('data-table-row').first()
    await expect(row).toBeVisible()
    await row.getByTestId('formula-actions-dropdown').click()

    // Formulas are IMMUTABLE — an object that pinned one must keep evaluating to the same number,
    // so a change is a new formula. An Edit action would promise something the model forbids.
    await expect(page.getByTestId('formula-action-duplicate')).toBeVisible()
    await expect(page.getByTestId('formula-action-edit')).toHaveCount(0)
  })

  test('FM5: the reference dialog opens and lists functions', async ({
    page,
  }) => {
    await tour(page, 'formulasReference').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/sqrt|abs|round|min|max/i).first()
    ).toBeVisible()
  })

  test('FM1b: a formula can be created and appears in the list', async ({
    page,
  }) => {
    const name = `${stamp()}-fm`
    await tour(page, 'formulasCreate').click()

    await page.getByLabel(/name/i).first().fill(name)
    await page.getByLabel(/expression/i).fill('width * height')

    // The exact label. `/create|save/i` also matches the page's own create button, and `.last()`
    // is a guess about DOM order rather than a statement about which control is meant.
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()

    await expect(
      page.getByTestId('data-table-row').filter({ hasText: name })
    ).toHaveCount(1)
  })
})
