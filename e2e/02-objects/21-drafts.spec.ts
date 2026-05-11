import { test, expect } from '@playwright/test'

import { getDialog } from '../utils/test-helpers'

/**
 * Object creation drafts (UI-only).
 *
 * Verifies the three behaviours that were tightened in the drafts hardening
 * pass:
 *   1. The close dialog gates *all* dirty closes (3 buttons in create mode).
 *   2. The worthiness gate keeps name-only edits OUT of the draft list.
 *   3. Opening an existing draft and closing it does NOT spawn a duplicate
 *      (regression test for the activeId race in use-form-draft-persistence).
 *
 * Drafts are pure client-side state — we clean up by clearing localStorage
 * keys at the start of each test instead of going through the backend.
 */

const runId = Date.now()

test.describe('21 - Object creation drafts', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    // Wipe any drafts from previous runs so the table starts clean.
    await page.evaluate(() => {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('iom-drafts:objects:')) toRemove.push(k)
      }
      toRemove.forEach((k) => localStorage.removeItem(k))
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('Worthiness gate: name-only + Discard → no draft persisted', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(`Draft TC-NoSave ${runId}`)

    // ESC should now open the 3-button confirm dialog (not silently close).
    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await expect(
      confirm.getByRole('button', { name: /save as draft/i })
    ).toBeVisible()
    await expect(
      confirm.getByRole('button', { name: /discard changes/i })
    ).toBeVisible()
    await expect(
      confirm.getByRole('button', { name: /continue editing/i })
    ).toBeVisible()

    await confirm.getByRole('button', { name: /discard changes/i }).click()
    await expect(sheet).toBeHidden()

    // No draft row in the table.
    await expect(
      page.locator('tbody tr').filter({ hasText: /^Draft$/ })
    ).toHaveCount(0)
  })

  test('Save as draft: name-only escape hatch persists a draft row', async ({
    page,
  }) => {
    const draftName = `Draft TC-Save ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await sheet.getByLabel('Name').fill(draftName)

    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog')
    await confirm.getByRole('button', { name: /save as draft/i }).click()
    await expect(sheet).toBeHidden()

    const draftRow = page.locator('tbody tr').filter({ hasText: draftName })
    await expect(draftRow).toBeVisible()
    await expect(draftRow.getByText('Draft', { exact: true })).toBeVisible()
  })

  test('Regression: open existing draft + ESC + Keep editing does not duplicate', async ({
    page,
  }) => {
    const draftName = `Draft TC-NoDup ${runId}`

    // Seed one draft via the Save-as-draft flow.
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await sheet.getByLabel('Name').fill(draftName)
    await page.keyboard.press('Escape')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /save as draft/i })
      .click()
    await expect(sheet).toBeHidden()

    const matchingRows = page.locator('tbody tr').filter({ hasText: draftName })
    await expect(matchingRows).toHaveCount(1)

    // Reopen the draft via its row's Open button, then close immediately.
    await matchingRows
      .first()
      .locator('[data-testid="draft-open-button"]')
      .click()
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')

    // The form is "dirty" relative to blank defaults (we loaded a name), so
    // the confirm dialog will appear. Pick Keep editing then close via the
    // dialog's Discard so the regression assertion is the row count, not the
    // closing mechanism. Either path must NOT create a second row.
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: /continue editing/i }).click()
    await expect(sheet).toBeVisible()

    // Now actually close: Save as draft (idempotent) so storage updates but
    // we don't accidentally delete the row before the count assertion.
    await page.keyboard.press('Escape')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /save as draft/i })
      .click()
    await expect(sheet).toBeHidden()

    // Critical: still exactly one row for this draft name.
    await expect(matchingRows).toHaveCount(1)
  })

  test('Discard from row dropdown removes the draft', async ({ page }) => {
    const draftName = `Draft TC-Discard ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await sheet.getByLabel('Name').fill(draftName)
    await page.keyboard.press('Escape')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /save as draft/i })
      .click()
    await expect(sheet).toBeHidden()

    const row = page.locator('tbody tr').filter({ hasText: draftName }).first()
    await expect(row).toBeVisible()

    // Open the row's actions dropdown and pick Discard.
    await row.locator('[data-testid="draft-actions-dropdown"]').click()
    await page.getByRole('menuitem', { name: /discard/i }).click()

    // Confirm the destructive dialog.
    const confirm = page.getByRole('alertdialog')
    await confirm.getByRole('button', { name: /^discard$/i }).click()

    await expect(
      page.locator('tbody tr').filter({ hasText: draftName })
    ).toHaveCount(0)
  })
})
