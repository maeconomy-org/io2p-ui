import { expect, test } from '../fixtures/app'
import { selectView } from '../utils/views'

/**
 * §6.11 PR3, PR4, PR15 — the process view selector.
 * Not `.read.`: the choice is an account preference stored on the node, so running this in
 * parallel changes what every other worker sees.
 */

test.describe('07 - processes / views', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/processes')
    await selectView(page, 'table')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('PR3/PR15: the Sankey view replaces the table and the choice persists', async ({
    page,
  }) => {
    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await selectView(page, 'sankey')
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    await expect(page.getByTestId('filter-menu')).toHaveCount(0)

    // Held only in component state it would revert on reload.
    await page.reload()
    await expect(page.getByTestId('data-table')).toHaveCount(0)
    await expect(page.getByTestId('view-option-sankey')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('PR4: the stored view never paints the wrong view first', async ({
    page,
  }) => {
    await page.goto('/processes')
    await selectView(page, 'sankey')
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    // A swap is visible for one frame, but the same divergence is reliably reported as a
    // hydration error, which `consoleGuard` fails on.
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.reload()
    await expect(page.getByTestId('view-option-sankey')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await expect
      .poll(() => errors.filter((t) => /[Hh]ydration/.test(t)).length, {
        timeout: 4000,
      })
      .toBe(0)
  })
})
