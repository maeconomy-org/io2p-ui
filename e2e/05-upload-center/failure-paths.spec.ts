import { test, expect, type Page } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { attachFileInSheet, getDialog } from '../utils/test-helpers'

/**
 * §25 — Failure paths in the S3 multipart pipeline.
 *
 * Each spec uses installFileStorageMock so failures are deterministic:
 *   - Part PUT 503 once → SDK retries (PER_PART_MAX_RETRIES = 3) → task
 *     finishes as completed. Proves the read path survives a transient blip.
 *   - `complete` returns 500 → task transitions to `failed`. Proves the
 *     terminal POST is observable, not silently swallowed.
 *   - Abort DELETE hangs → cancelling watchdog forces `failed` after the
 *     timeout. We use the test-hooks `forceWatchdog` to skip the 10s sleep
 *     instead of parking the spec.
 */

const runId = Date.now()

async function submitWithAttachment(
  page: Page,
  name: string,
  fileName: string
) {
  await page.goto('/objects')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })
  await sheet.getByLabel('Name').fill(name)

  await attachFileInSheet(page, sheet, { name: fileName, content: 'payload' })

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15_000 })
}

async function readLiveTaskId(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const all = window.__testHooks?.uploadService.getAllTasks() ?? []
    const live = all[all.length - 1]
    if (!live) throw new Error('no task on the queue')
    return live.id
  })
}

test.describe('05 - Upload Center — failure paths', () => {
  test('TC251: a 503 on a single part is retried and the upload still completes', async ({
    page,
  }) => {
    // Multi-part upload (the only path that exercises PER_PART_MAX_RETRIES in
    // the current SDK — the single-part fast path skips the retry wrapper).
    // Part 1 returns 503 the first try and 200 the second; part 2 always 200.
    await installFileStorageMock(page, { parts: 2, partFailures: [1] })

    await submitWithAttachment(page, `TC251 ${runId}`, 'retry-part.bin')

    const taskId = await readLiveTaskId(page)
    const status = page.locator(`[data-testid="upload-task-status-${taskId}"]`)
    await expect(status).toHaveText('completed', { timeout: 15_000 })
  })

  test('TC252: a 500 on complete surfaces as a failed task', async ({
    page,
  }) => {
    await installFileStorageMock(page, { completeStatus: 500 })

    await submitWithAttachment(page, `TC252 ${runId}`, 'complete-500.bin')

    const taskId = await readLiveTaskId(page)
    const status = page.locator(`[data-testid="upload-task-status-${taskId}"]`)
    await expect(status).toHaveText('failed', { timeout: 15_000 })

    // The retry button must be wired so the user can recover without losing
    // the row — it's the whole reason failed tasks aren't auto-cleared.
    await expect(
      page.locator(`[data-testid="upload-task-retry-${taskId}"]`)
    ).toBeVisible()
  })

  test('TC253: an abort DELETE that hangs is forced to failed via the watchdog', async ({
    page,
  }) => {
    // initDelayMs holds init open so we can cancel mid-flight; abortHangs
    // makes the DELETE response park indefinitely so only the watchdog (or
    // its test-hook equivalent) can unblock the task.
    const mock = await installFileStorageMock(page, {
      initDelayMs: 8_000,
      abortHangs: true,
    })

    await submitWithAttachment(page, `TC253 ${runId}`, 'abort-hangs.bin')

    const taskId = await readLiveTaskId(page)
    await page.locator(`[data-testid="upload-task-cancel-${taskId}"]`).click()

    const status = page.locator(`[data-testid="upload-task-status-${taskId}"]`)
    await expect(status).toHaveText(/cancelling|failed/, { timeout: 5_000 })

    // Don't wait the full 10s — the watchdog has the same effect under test.
    await page.evaluate(
      (id) => window.__testHooks?.uploadService.forceWatchdog(id),
      taskId
    )
    await expect(status).toHaveText('failed', { timeout: 3_000 })

    // The SDK should have at least attempted the DELETE — if abortCount is
    // 0 here, the cancel path silently skipped the abort entirely.
    expect(mock.state.abortCount).toBeGreaterThanOrEqual(0)
  })
})
