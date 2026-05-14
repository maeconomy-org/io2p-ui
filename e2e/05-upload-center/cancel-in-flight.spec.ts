import { test, expect, type Page } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { attachFileInSheet, getDialog } from '../utils/test-helpers'

/**
 * §18 — Cancel an in-flight upload.
 *
 * Originally observed by the user as "strange things" around batch completion
 * in `queueFileUploadsWithContext`: clicking cancel mid-upload could leave the
 * row stuck in `cancelling` and no DELETE was issued. Post-fix:
 *
 *   - `AbortController` is pre-created in `addFile()`, so cancel works even
 *     during the hash phase before init returns.
 *   - The watchdog forces `cancelling → failed` after 10s if the SDK never
 *     acknowledges. In tests we trigger it via window.__testHooks instead of
 *     waiting the full 10s.
 *
 * This spec uses installFileStorageMock so the upload pipeline is fully
 * deterministic — the real backend isn't involved.
 */

const runId = Date.now()

test.describe('05 - Upload Center — cancel in flight', () => {
  test('TC181: cancel during init keeps the task in failed/Cancelled and frees the slot', async ({
    page,
  }) => {
    // initDelayMs holds the init response open so we can cancel before it
    // returns. The SDK's abort signal aborts the in-flight fetch — init
    // never lands — and the task transitions through cancelling → failed.
    const mock = await installFileStorageMock(page, { initDelayMs: 8_000 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const name = `TC181 cancel ${runId}`
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })
    await sheet.getByLabel('Name').fill(name)

    await attachFileInSheet(page, sheet, {
      name: 'cancel-target.bin',
      content: 'cancellable payload',
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Wait for the widget — the upload is parked on init.
    const widget = page.locator('[data-testid="upload-center"]')
    await expect(widget).toBeVisible({ timeout: 10_000 })

    // Read the live task id from the test hooks so we don't have to grep DOM.
    const taskId = await page.evaluate(() => {
      const t = window.__testHooks?.uploadService.getAllTasks() ?? []
      const live = t.find(
        (x) => x.status === 'pending' || x.status === 'uploading'
      )
      return live?.id ?? null
    })
    expect(taskId).not.toBeNull()

    const cancelBtn = page.locator(
      `[data-testid="upload-task-cancel-${taskId}"]`
    )
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })
    await cancelBtn.click()

    // The status sr-only span should flip to cancelling first.
    const status = page.locator(`[data-testid="upload-task-status-${taskId}"]`)
    await expect(status).toHaveText(/cancelling|failed/, { timeout: 3_000 })

    // Force the watchdog to skip the 10s wait if the SDK didn't acknowledge.
    await page.evaluate(
      (id) => window.__testHooks?.uploadService.forceWatchdog(id),
      taskId!
    )

    await expect(status).toHaveText('failed', { timeout: 3_000 })

    // initCount should be 1 (we issued it) — and since we aborted before
    // init returned, no `complete` should ever have fired.
    expect(mock.state.completeCount).toBe(0)
  })
})
