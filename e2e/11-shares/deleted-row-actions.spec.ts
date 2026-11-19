import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { createObjectWithId } from '../utils/process'

/**
 * A soft-deleted row NARROWS its own menu, and offers Restore where Delete was.
 *
 * `bulk.spec.ts` L11 round-trips delete and restore through the SELECTION
 * controls, so the per-row half has never been opened. L6 asserts struck-through
 * rows without opening their menu at all.
 *
 * The gating is one `isDeleted` branch feeding four separate renders, which is
 * the shape that regresses in one place and stays green in the other three.
 */

async function showDeleted(page: Page): Promise<void> {
  await page.getByTestId('filter-menu').click()
  await page.getByTestId('filter-option-deleted').click()
  await page.keyboard.press('Escape')
}

/**
 * `filter-option-deleted` is a TOGGLE, and every test here turns it on itself,
 * so turning it off is deterministic. `filter-clear` renders only while a filter
 * is active, which would make the reset conditional on reading a control.
 */
async function hideDeleted(page: Page): Promise<void> {
  await page.getByTestId('filter-menu').click()
  await page.getByTestId('filter-option-deleted').click()
  await page.keyboard.press('Escape')
}

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

/**
 * `delete-confirmation-dialog.tsx` carries no testid, so this is the one prose
 * locator in the file. Isolated here rather than inlined twice, so adding a
 * testid later is a one-line change.
 */
async function confirmDelete(page: Page): Promise<void> {
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /delete/i })
    .click()
}

async function openMenu(page: Page, name: string): Promise<void> {
  const row = rowFor(page, name)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByTestId('object-actions-dropdown').click()
}

test.describe('11 - shares / deleted row actions', () => {
  // The filter is a stored preference, so it outlives this file. Cleared
  // unconditionally rather than by reading the control: asking the UI whether it
  // applied the filter is the question it is least able to answer honestly.
  test.afterEach(async ({ page }) => {
    await page.goto('/objects')
    await hideDeleted(page)
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('SD1: a deleted row drops Duplicate, Create-template and Share, and offers Restore', async ({
    page,
  }) => {
    const name = `e2e-${Date.now()}-deleted`
    await createObjectWithId(page, name)

    await page.goto('/objects')
    await openMenu(page, name)

    // Alive first, so the four absences below are a CHANGE rather than a menu
    // that never rendered them.
    await expect(page.getByTestId('object-action-duplicate')).toBeVisible()
    await expect(
      page.getByTestId('object-action-create-template')
    ).toBeVisible()
    await expect(page.getByTestId('object-action-delete')).toBeVisible()
    await expect(page.getByTestId('object-action-restore')).toHaveCount(0)

    await page.getByTestId('object-action-delete').click()
    await confirmDelete(page)
    await expect(rowFor(page, name)).toHaveCount(0)

    await showDeleted(page)
    await openMenu(page, name)

    await expect(page.getByTestId('object-action-duplicate')).toHaveCount(0)
    await expect(page.getByTestId('object-action-create-template')).toHaveCount(
      0
    )
    await expect(page.getByTestId('object-action-share')).toHaveCount(0)
    await expect(page.getByTestId('object-action-delete')).toHaveCount(0)

    // Show-QR survives deletion — the control that proves the menu rendered at
    // all, so the four absences above are gating and not an empty dropdown.
    await expect(page.getByTestId('object-action-show-qr')).toBeVisible()
    await expect(page.getByTestId('object-action-restore')).toBeVisible()
  })

  test('SD2: the per-row Restore returns the object to the default list', async ({
    page,
  }) => {
    const name = `e2e-${Date.now()}-restored`
    await createObjectWithId(page, name)

    await page.goto('/objects')
    await openMenu(page, name)
    await page.getByTestId('object-action-delete').click()
    await confirmDelete(page)
    await expect(rowFor(page, name)).toHaveCount(0)

    await showDeleted(page)
    await openMenu(page, name)
    await page.getByTestId('object-action-restore').click()

    // The round trip only proves itself with the filter OFF: a restored row that
    // still needs `deleted` to be visible was never restored.
    await hideDeleted(page)
    await expect(rowFor(page, name)).toBeVisible({ timeout: 20_000 })
  })
})
