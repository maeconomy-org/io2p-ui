import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { getDialog } from '../utils/test-helpers'

/**
 * §16 — Cancel a still-pending task.
 *
 * With maxConcurrent=1, the second of two queued tasks is parked in `pending`.
 * Cancelling it must:
 *   - flip status straight to `failed` (no `cancelling` interlude — it never
 *     left the queue),
 *   - NOT issue a FileStorage/init for the cancelled task (proven by the
 *     mock's initCount staying at 1).
 */

const runId = Date.now()

test.describe('05 - Upload Center — cancel pending', () => {
  test('TC161: cancelling a pending task never hits init', async ({ page }) => {
    // First task parks on init forever so the second can never start.
    const mock = await installFileStorageMock(page, { initDelayMs: 60_000 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page
      .evaluate(() => window.__testHooks?.uploadService.setMaxConcurrent(1))
      .catch(() => {})

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC161 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Two files in one shot — the second is still pending behind the first.
    await modal.locator('input[type="file"]').setInputFiles([
      {
        name: 'a.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('first'),
      },
      {
        name: 'b.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('second'),
      },
    ])
    await page.locator('[data-testid="attachment-modal-done-button"]').click()
    const confirm = page.locator('[data-testid="upload-files-confirm-button"]')
    if (await confirm.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirm.click()
    }
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Find the pending task id via test hooks.
    const pendingId = await page.evaluate(() => {
      const all = window.__testHooks?.uploadService.getAllTasks() ?? []
      return all.find((t) => t.status === 'pending')?.id ?? null
    })
    expect(pendingId).not.toBeNull()

    await page
      .locator(`[data-testid="upload-task-cancel-${pendingId}"]`)
      .click()

    const status = page.locator(
      `[data-testid="upload-task-status-${pendingId}"]`
    )
    await expect(status).toHaveText('failed', { timeout: 3_000 })

    // Only the first task fired init — the cancelled one never did.
    expect(mock.state.initCount).toBeLessThanOrEqual(1)
  })
})
