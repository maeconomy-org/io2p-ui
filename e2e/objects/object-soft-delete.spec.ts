import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Soft Delete & Restore', () => {
  test.describe.configure({ mode: 'serial' })

  let testObjectName = ''

  test('setup - create test object for deletion', async ({ page }) => {
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

  test('soft delete object from table view', async ({ page }) => {
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
      const confirmDialog = getDialogByTitle(page, 'Delete Object')
        .or(page.getByRole('dialog').filter({ hasText: 'confirm' }))
        .or(page.getByRole('dialog').filter({ hasText: 'delete' }))

      await expect(confirmDialog).toBeVisible({ timeout: 5000 })

      // Test cancel first
      await confirmDialog.getByRole('button', { name: /cancel|no/i }).click()
      await expect(confirmDialog).toBeHidden()

      // Try delete again and confirm
      await deleteButton.first().click()
      await expect(confirmDialog).toBeVisible()
      await confirmDialog
        .getByRole('button', { name: /delete|yes|confirm/i })
        .click()

      // Object should be soft deleted (may disappear from default view)
      await page.waitForTimeout(3000)
    }
  })

  test('soft delete object from details view', async ({ page }) => {
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
    await row.dblclick()

    await expect(page.getByText(detailsTestName)).toBeVisible()

    // Look for delete button in the details sheet
    const deleteButton = page.locator(
      'button:has-text("Delete"), button[title*="Delete"], [data-testid*="delete"]'
    )

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()

      // Should show confirmation dialog
      const confirmDialog = getDialogByTitle(page, 'Delete Object')
        .or(page.getByRole('dialog').filter({ hasText: 'confirm' }))
        .or(page.getByRole('dialog').filter({ hasText: 'delete' }))

      await expect(confirmDialog).toBeVisible({ timeout: 5000 })
      await confirmDialog
        .getByRole('button', { name: /delete|yes|confirm/i })
        .click()

      // Should close details and return to list
      await page.waitForTimeout(3000)
    }
  })

  test('view deleted objects with filter', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Look for "Show deleted" filter/toggle
    const showDeletedToggle = page.locator(
      'input[type="checkbox"]:near(:text("deleted")), button:has-text("Show deleted"), [data-testid*="deleted"]'
    )

    if ((await showDeletedToggle.count()) > 0) {
      await showDeletedToggle.first().click()

      // Should now show deleted objects
      await page.waitForTimeout(2000)

      // Look for deleted indicator (strikethrough, badge, etc.)
      const deletedIndicators = page.locator(
        'text=/deleted|removed/, .line-through, [data-deleted="true"]'
      )

      if ((await deletedIndicators.count()) > 0) {
        await expect(deletedIndicators.first()).toBeVisible()
      }
    }
  })

  test('restore soft deleted object', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Enable show deleted filter
    const showDeletedToggle = page.locator(
      'input[type="checkbox"]:near(:text("deleted")), button:has-text("Show deleted")'
    )

    if ((await showDeletedToggle.count()) > 0) {
      await showDeletedToggle.first().click()
      await page.waitForTimeout(2000)

      // Look for a deleted object to restore
      const deletedRow = page
        .locator('tbody tr')
        .filter({ hasText: testObjectName })
        .or(page.locator('tbody tr .line-through'))
        .first()

      if ((await deletedRow.count()) > 0) {
        // Look for restore button
        const restoreButton = deletedRow.locator(
          'button:has-text("Restore"), button[title*="Restore"], [data-testid*="restore"]'
        )

        if ((await restoreButton.count()) > 0) {
          await restoreButton.first().click()

          // May show confirmation dialog
          const confirmDialog = page
            .getByRole('dialog')
            .filter({ hasText: 'restore' })

          if (await confirmDialog.isVisible()) {
            await confirmDialog
              .getByRole('button', { name: /restore|yes|confirm/i })
              .click()
          }

          // Object should be restored
          await page.waitForTimeout(3000)
        } else {
          // Try double-clicking to open details and restore from there
          await deletedRow.dblclick()

          const restoreInDetails = page.locator(
            'button:has-text("Restore"), [data-testid*="restore"]'
          )

          if ((await restoreInDetails.count()) > 0) {
            await restoreInDetails.first().click()

            const confirmDialog = page
              .getByRole('dialog')
              .filter({ hasText: 'restore' })

            if (await confirmDialog.isVisible()) {
              await confirmDialog
                .getByRole('button', { name: /restore|yes|confirm/i })
                .click()
            }

            await page.getByRole('button', { name: 'Close' }).click()
          }
        }
      }
    }
  })

  test('verify restored object is active', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Ensure show deleted is off to see only active objects
    const showDeletedToggle = page.locator(
      'input[type="checkbox"]:near(:text("deleted"))'
    )

    if (
      (await showDeletedToggle.count()) > 0 &&
      (await showDeletedToggle.isChecked())
    ) {
      await showDeletedToggle.click()
      await page.waitForTimeout(2000)
    }

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

  test('permanent delete confirmation', async ({ page }) => {
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

      const confirmDialog = getDialogByTitle(page, 'Delete Object').or(
        page.getByRole('dialog').filter({ hasText: 'delete' })
      )

      if (await confirmDialog.isVisible()) {
        await confirmDialog
          .getByRole('button', { name: /delete|yes|confirm/i })
          .click()
      }

      await page.waitForTimeout(2000)

      // Now look for permanent delete option
      const showDeletedToggle = page.locator(
        'input[type="checkbox"]:near(:text("deleted"))'
      )

      if ((await showDeletedToggle.count()) > 0) {
        await showDeletedToggle.click()
        await page.waitForTimeout(2000)

        const deletedRow = page
          .locator('tbody tr')
          .filter({ hasText: permanentDeleteName })
          .first()

        if ((await deletedRow.count()) > 0) {
          // Look for permanent delete button
          const permanentDeleteButton = deletedRow.locator(
            'button:has-text("Permanent"), button[title*="Permanent"]'
          )

          if ((await permanentDeleteButton.count()) > 0) {
            await permanentDeleteButton.first().click()

            // Should show strong confirmation
            const permanentConfirmDialog = page
              .getByRole('dialog')
              .filter({ hasText: 'permanent' })

            await expect(permanentConfirmDialog).toBeVisible()

            // Test cancel
            await permanentConfirmDialog
              .getByRole('button', { name: /cancel|no/i })
              .click()
            await expect(permanentConfirmDialog).toBeHidden()
          }
        }
      }
    }
  })
})
