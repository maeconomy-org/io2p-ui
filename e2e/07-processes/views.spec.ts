import { expect, test } from '../fixtures/app'

/**
 * §6.11 PR3, PR4, PR15 — the process view selector.
 *
 * Not `.read.`: the choice is an account preference stored on the node, so running this in
 * parallel changes what every other worker sees.
 */

test.describe('07 - processes / views', () => {
  test.afterEach(async ({ page }) => {
    // Restore, or every later spec starts in a graph view with no table to assert against.
    await page.goto('/processes')
    await page.getByTestId('view-option-table').click()
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('PR3/PR15: the Sankey view replaces the table and the choice persists', async ({
    page,
  }) => {
    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page.getByTestId('view-option-sankey').click()
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    // PR2 from the other side: the filters belong to the table, so a graph view must not show a
    // control that has nothing to act on.
    await expect(page.getByTestId('filter-menu')).toHaveCount(0)

    // The preference half. Held only in component state it would revert on reload, and the
    // setting on /settings would appear to do nothing.
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
    await page.getByTestId('view-option-sankey').click()
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    // The `viewResolved` gate: a reload must never show the table and then swap. A swap is only
    // visible for a frame, so watching for it is unreliable — but the same divergence between the
    // server render and the first client render IS reliably reported as a hydration error, and
    // `consoleGuard` fails the test on one. `00-harness/hydration.read.spec.ts` covers the general
    // case; this pins it for the non-default view, which is the one that can differ.
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
