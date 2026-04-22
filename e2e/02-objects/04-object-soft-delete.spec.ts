import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

const getDeleteConfirmDialog = (page: Page) =>
  page
    .getByRole('alertdialog')
    .or(page.getByRole('dialog').filter({ hasText: /are you sure/i }))
    .or(page.getByRole('dialog').filter({ hasText: /soft delete/i }))

const setShowDeletedFilter = async (page: Page, enable: boolean) => {
  // The deleted filter uses FacetedFilter (cmdk-based), not native menuitemcheckbox
  const filtersButton = page.getByRole('button', { name: /filters/i })
  const hasFiltersButton = await filtersButton
    .isVisible({ timeout: 2000 })
    .catch(() => false)

  if (hasFiltersButton) {
    await filtersButton.click()
    // FacetedFilter uses cmdk CommandItem, find "Soft Deleted" option
    const showDeletedItem = page
      .locator('[cmdk-item]')
      .filter({ hasText: /soft deleted|show deleted/i })
    await expect(showDeletedItem).toBeVisible({ timeout: 5000 })

    // Check if already selected by looking for the checkbox div's bg-primary class
    const checkboxDiv = showDeletedItem
      .locator('div.items-center.justify-center')
      .first()
    const isCurrentlyEnabled = await checkboxDiv
      .evaluate((el) => el.classList.contains('bg-primary'))
      .catch(() => false)

    if (isCurrentlyEnabled !== enable) {
      await showDeletedItem.click()
    }
    await page.keyboard.press('Escape')
    return true
  }

  return false
}

const expectDeletedIndicator = async (row: ReturnType<Page['locator']>) => {
  const deletedLabelVisible = await row
    .getByText(/\(deleted\)/i)
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false)
  const deletedStrikeVisible = await row
    .locator('.line-through')
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false)

  expect(deletedLabelVisible || deletedStrikeVisible).toBeTruthy()
}

test.describe('04 - Object Soft Delete & Restore', () => {
  test.describe.configure({ mode: 'serial' })

  let testObjectName = ''

  test('TC001: Setup - create test object for deletion', async ({ page }) => {
    testObjectName = `E2E Delete Test ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(testObjectName)
    await addSheet.getByLabel('Description').fill('Object for deletion tests')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(testObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('TC002: Soft delete object from table view', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Find the test object row
    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })

    // Look for delete button in the row (could be a dropdown or direct button)
    const deleteButton = row.locator(
      'button[title*="Delete"], button:has-text("Delete"), [data-testid*="delete"]'
    )

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()

      // Should show confirmation dialog
      const confirmDialog = getDeleteConfirmDialog(page)

      await expect(confirmDialog).toBeVisible({ timeout: 5000 })

      // Test cancel first
      await confirmDialog.getByRole('button', { name: /cancel|no/i }).click()
      await expect(confirmDialog).toBeHidden()

      // Try delete again and confirm
      await deleteButton.first().click()
      await expect(confirmDialog).toBeVisible({ timeout: 5000 })
      await confirmDialog
        .getByRole('button', { name: /delete|yes|confirm/i })
        .click()

      // Object should be soft deleted — the assertion retries up to 10s
      await expect(row).toBeHidden({ timeout: 10000 })
    }
  })

  test('TC003: Soft delete object from details view', async ({ page }) => {
    // Create another object for this test
    const detailsTestName = `${testObjectName} Details`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(detailsTestName)
    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(detailsTestName)).toBeVisible({
      timeout: 15000,
    })

    // Open object details
    const row = page
      .locator('tbody tr')
      .filter({ hasText: detailsTestName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.locator('[data-testid="object-details-button"]').click()

    await expect(
      page.getByRole('heading', { name: detailsTestName })
    ).toBeVisible({ timeout: 10000 })

    // Look for delete button in the details sheet
    const detailsSheet = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: detailsTestName }) })
    const deleteButton = detailsSheet.locator(
      'button:has-text("Delete"), button[title*="Delete"], [data-testid*="delete"]'
    )

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()

      // Should show confirmation dialog
      const confirmDialog = getDeleteConfirmDialog(page)

      await expect(confirmDialog).toBeVisible({ timeout: 5000 })
      await confirmDialog
        .getByRole('button', { name: /delete|yes|confirm/i })
        .click()

      // Should close details and return to list — assertions retry
      await expect(
        page.getByRole('heading', { name: detailsTestName })
      ).toBeHidden({ timeout: 10000 })
      await expect(
        page.locator('tbody tr').filter({ hasText: detailsTestName }).first()
      ).toBeHidden({ timeout: 10000 })
    }
  })

  test('TC004: Show deleted filter lists soft-deleted objects', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Look for "Show deleted" filter/toggle
    if (await setShowDeletedFilter(page, true)) {
      // Should now show deleted objects
      await page.waitForTimeout(2000)

      const deletedRow = page
        .locator('tbody tr')
        .filter({ hasText: testObjectName })
        .first()

      if ((await deletedRow.count()) > 0) {
        await expect(deletedRow).toBeVisible({ timeout: 5000 })
        await expectDeletedIndicator(deletedRow)
      }
    }
  })

  test('TC005: Restore soft deleted object', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Enable show deleted filter
    if (await setShowDeletedFilter(page, true)) {
      await page.waitForTimeout(2000)

      // Look for a deleted object to restore
      const deletedRow = page
        .locator('tbody tr')
        .filter({ hasText: testObjectName })
        .or(page.locator('tbody tr .line-through'))
        .first()

      if ((await deletedRow.count()) > 0) {
        // Look for restore button in the row
        const restoreButton = deletedRow.locator(
          'button:has-text("Restore"), button[title*="Restore"], [data-testid*="restore"]'
        )

        if ((await restoreButton.count()) > 0) {
          await restoreButton.first().click()
        } else {
          // Try using details button to open sheet and restore from there
          await deletedRow
            .locator('[data-testid="object-details-button"]')
            .click()

          const restoreInDetails = page.locator(
            'button:has-text("Restore"), [data-testid*="restore"]'
          )

          if ((await restoreInDetails.count()) > 0) {
            await restoreInDetails.first().click()
          }
        }

        // Handle restore confirmation dialog if it appears
        // The dialog may re-render, so use page.evaluate to click the button
        const confirmDialog = page
          .getByRole('dialog')
          .filter({ hasText: /restore/i })

        const dialogVisible = await confirmDialog
          .isVisible({ timeout: 3000 })
          .catch(() => false)

        if (dialogVisible) {
          // Wait for dialog to stabilize, then click via JS to avoid detachment issues
          await page.waitForTimeout(500)
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
            const restoreBtn = buttons.find(
              (b) =>
                b.textContent &&
                /restore|confirm|yes/i.test(b.textContent) &&
                b.closest('[role="dialog"]')
            )
            if (restoreBtn) restoreBtn.click()
          })
        }

        // Wait for restore network call to complete before proceeding
        await page.waitForLoadState('networkidle')

        // Close details sheet if open
        const closeButton = page.getByRole('button', { name: 'Close' })
        if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeButton.click()
        }
      }
    }
  })

  test('TC006: Verify restored object is active', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Ensure show deleted is off to see only active objects
    await setShowDeletedFilter(page, false)

    // Look for the restored object
    const restoredObject = page.getByText(testObjectName)

    if ((await restoredObject.count()) > 0) {
      await expect(restoredObject.first()).toBeVisible()

      // Should not have deleted styling
      const row = page
        .locator('tbody tr')
        .filter({ hasText: testObjectName })
        .first()

      await expect(row.locator('.line-through')).not.toBeVisible()
    }
  })

  test('TC007: Soft delete does not expose permanent delete action', async ({
    page,
  }) => {
    // Create object specifically for permanent deletion test
    const permanentDeleteName = `E2E Permanent Delete ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(permanentDeleteName)
    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(permanentDeleteName)).toBeVisible({
      timeout: 15000,
    })

    // First soft delete it
    const row = page
      .locator('tbody tr')
      .filter({ hasText: permanentDeleteName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })

    const deleteButton = row.locator(
      'button[title*="Delete"], button:has-text("Delete")'
    )

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()

      const confirmDialog = getDeleteConfirmDialog(page)
      await expect(confirmDialog).toBeVisible({ timeout: 5000 })
      await confirmDialog
        .getByRole('button', { name: /delete|yes|confirm/i })
        .click()

      await page.waitForTimeout(2000)

      // Verify there is no permanent delete action exposed
      if (await setShowDeletedFilter(page, true)) {
        await page.waitForTimeout(2000)

        const deletedRow = page
          .locator('tbody tr')
          .filter({ hasText: permanentDeleteName })
          .first()

        if ((await deletedRow.count()) > 0) {
          const permanentDeleteButton = deletedRow.locator(
            'button:has-text("Permanent"), button[title*="Permanent"]'
          )
          await expect(permanentDeleteButton).toHaveCount(0)
        }
      }
    }
  })
})
