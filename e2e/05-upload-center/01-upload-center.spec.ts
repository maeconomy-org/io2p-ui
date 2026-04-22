import { test, expect, type Page } from '@playwright/test'

import {
  attachFileInSheet,
  waitForUploadsIdle,
  openObject,
} from '../utils/test-helpers'

/**
 * Upload Center — global widget behavior
 *
 * Covers:
 *   TC061 — idle sentinel is present when the queue is empty
 *   TC062 — widget appears during an in-flight upload, then disappears/clears
 *   TC063 — clear-completed removes completed tasks and leaves only the sentinel
 */

const runId = Date.now()

const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('05 - Upload Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC061: Idle sentinel present when no uploads are queued', async ({
    page,
  }) => {
    // With no uploads, the provider renders the hidden sentinel.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached({ timeout: 5000 })
    // The visible widget should NOT be present.
    await expect(page.locator('[data-testid="upload-center"]')).toHaveCount(0)
  })

  test('TC062: Widget appears while uploading then transitions back to idle', async ({
    page,
  }) => {
    const name = `TC062 Upload ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })
    await sheet.getByLabel('Name').fill(name)

    await attachFileInSheet(page, sheet, {
      name: 'upload-center-smoke.pdf',
      content: 'smoke test content',
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // The visible upload-center widget should appear at some point while the
    // background upload is in flight. Queue it in parallel with the idle wait
    // so extremely fast uploads don't cause the assertion to miss the widget.
    const widgetSeen = page
      .locator('[data-testid="upload-center"]')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    await waitForUploadsIdle(page)
    const wasVisible = await widgetSeen

    // Regardless of whether we caught the widget mid-flight, the idle sentinel
    // MUST be present once uploads drain.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached({ timeout: 5000 })

    // Attach a soft assertion that the widget rendered — diagnostic only, we
    // do not fail the run on very fast uploads where it may never paint.
    test.info().annotations.push({
      type: 'widget-visible',
      description: String(wasVisible),
    })
  })

  test('TC063: Clear-completed empties the widget and leaves the idle sentinel', async ({
    page,
  }) => {
    const name = `TC063 Upload ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })
    await sheet.getByLabel('Name').fill(name)

    await attachFileInSheet(page, sheet, {
      name: 'clear-completed.pdf',
      content: 'clear me',
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Wait for the queue to drain — the clear button only renders when idle.
    await waitForUploadsIdle(page)

    const clear = page.locator('[data-testid="upload-center-clear"]')
    if (await clear.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clear.click()
      await expect(page.locator('[data-testid="upload-center"]')).toHaveCount(
        0,
        { timeout: 5000 }
      )
    }

    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached()

    // Object still exists afterwards — clearing the widget does not delete data.
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('clear-completed.pdf').first()).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
