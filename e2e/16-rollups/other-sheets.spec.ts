import { expect, test } from '../fixtures/app'
import { rowActions } from '../utils/selectors'

/**
 * Rollups belong to OBJECTS. `property-fields.tsx` threads a `rollups` map down from the object
 * sheet, and the template and process sheets pass nothing — a template describes a shape rather
 * than holding values, and a process is not an entity a subtree totals over.
 *
 * A negative test, which is the kind nobody writes: threading `rollups` through the shared
 * component "because it is already there" would put subtree totals on a template with no failure
 * anywhere to say so.
 */

test.describe('16 - rollups / other sheets', () => {
  test('RU7: a template sheet renders no rollup card', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Any template will do — the claim is about the SHEET, not about a template this test
    // authored, and creating one would only add a write path that can fail for other reasons.
    const row = page.getByTestId('data-table-row').first()
    await expect(row).toBeVisible()
    await rowActions(page, 'template', row).details.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // An absence proves nothing unless the sheet actually rendered: "no card" is also what an
    // empty dialog looks like.
    await expect(page.getByRole('tab').first()).toBeVisible()

    await expect(page.getByTestId('rollup-card')).toHaveCount(0)
    await expect(page.getByTestId('rollup-line')).toHaveCount(0)
  })

  test('RU7b: a process sheet renders no rollup card', async ({ page }) => {
    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()

    const row = page.getByTestId('data-table-row').first()
    // This file authors nothing — the claim is about the SHEET, and a process created here would
    // add a write path that can fail for reasons of its own. The cost is a hidden dependency on
    // `07-processes` having run first, which is invisible until the folder is run on its own
    // against an empty node. Skip with the reason rather than report a product bug.
    test.skip(
      (await row.count()) === 0,
      'no process on the node — run 07-processes first, or seed one'
    )
    await expect(row).toBeVisible()
    await rowActions(page, 'process', row).details.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('tab').first()).toBeVisible()

    await expect(page.getByTestId('rollup-card')).toHaveCount(0)
    await expect(page.getByTestId('rollup-line')).toHaveCount(0)
  })
})
