import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

/**
 * A soft-deleted parent still has a children page, and it has to SAY so.
 *
 * `056d1f0` put three renders behind one boolean — a struck-through heading, a Deleted badge and a
 * sentence under the uuid — and shipped them with no coverage. A reader who lands here from a
 * bookmark or a breadcrumb sees a normal-looking page otherwise, and the children are still listed:
 * deleting a parent does NOT cascade, so this is the only thing distinguishing a live branch from
 * one whose root is gone.
 */

const runId = Date.now()
const PARENT = `e2e-${runId}-pd-parent`
const CHILD = `e2e-${runId}-pd-child`

/** Captured after the first navigation — the spec never learns an id any other way. */
let parentUrl = ''

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

test.describe('04 - object children / a deleted parent', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    for (const [name, parent] of [
      [PARENT, undefined],
      [CHILD, PARENT],
    ] as const) {
      const panel = await openCreateSheet(page)
      await panel.getByLabel(/name/i).first().fill(name)
      if (parent) {
        await page.getByTestId('parent-picker').click()
        await page.getByTestId('parent-search').fill(parent)
        const option = page
          .locator('[data-testid^="parent-option-"]')
          .filter({ hasText: parent })
          .first()
        await expect(option).toBeVisible()
        await option.click()
        await page.keyboard.press('Escape')
      }
      await saveSheet(page)
      await expect(sheet(page)).toBeHidden()
    }

    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    parentUrl = page.url()
    await page.close()
  })

  test('PD1: a live parent says nothing about being deleted', async ({
    page,
  }) => {
    // The other side of the boolean. Without this the assertions below would pass just as happily
    // against a page that never renders the badge at all.
    await page.goto(parentUrl)
    await expect(page.getByRole('heading', { name: PARENT })).toBeVisible()
    await expect(page.getByTestId('parent-deleted-badge')).toHaveCount(0)
    await expect(page.getByTestId('parent-deleted-hint')).toHaveCount(0)
  })

  test('PD2: a deleted parent is marked, and still lists its children', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).getByRole('checkbox').check()
    await page.getByTestId('bulk-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(rowFor(page, PARENT)).toHaveCount(0)

    await page.goto(parentUrl)

    await expect(page.getByTestId('parent-deleted-badge')).toBeVisible()
    await expect(page.getByTestId('parent-deleted-hint')).toBeVisible()
    // The third render behind the same boolean: struck through, not merely dimmed.
    await expect(page.getByRole('heading', { name: PARENT })).toHaveClass(
      /line-through/
    )

    // Delete does not cascade, so the child is still here and still reachable. A page that hid
    // them would strand every descendant behind a parent nobody can open.
    await expect(rowFor(page, CHILD)).toBeVisible()
  })

  test('PD3: restoring the parent clears the marking', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')

    await rowFor(page, PARENT).getByRole('checkbox').check()
    await page.getByTestId('bulk-restore').click()
    await expect(page.getByTestId('bulk-bar')).toBeHidden()

    await page.goto(parentUrl)
    await expect(page.getByTestId('parent-deleted-badge')).toHaveCount(0)
    await expect(page.getByTestId('parent-deleted-hint')).toHaveCount(0)
  })

  // The deleted filter is ACCOUNT state and outlives this file. Restored to a KNOWN value rather
  // than to whatever it was: PD3 turns it on, and a run that failed before PD3 never read it.
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')
    // PD3 left it ON, so one click is OFF. Proved by the rows it hides rather than by reading the
    // control — a state check here is the thing the lint rule exists to stop.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await page.close()
  })
})
