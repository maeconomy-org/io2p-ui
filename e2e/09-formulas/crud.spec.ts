import { expect, test } from '../fixtures/app'
import { openDialog } from '../utils/sheet'
import { tour } from '../utils/selectors'

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

    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(name)
    await dialog.getByLabel(/expression/i).fill('width * height')

    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()

    await expect(
      page.getByTestId('data-table-row').filter({ hasText: name })
    ).toHaveCount(1)
  })
})
