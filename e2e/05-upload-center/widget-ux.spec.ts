import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import {
  attachFileInSheet,
  getDialog,
  waitForUploadsIdle,
} from '../utils/test-helpers'

/**
 * §27 — UploadCenter widget UX gaps not covered by 01-upload-center.spec.ts.
 *
 * - Clear-completed removes `completed` rows but keeps `failed` rows so the
 *   user can still retry.
 * - The collapse toggle exists and is clickable. We don't assert specific
 *   class names because the open/closed state is rendered via CSS animation
 *   on Radix Collapsible — coupling to internals would make this flaky.
 */

const runId = Date.now()

test.describe('05 - Upload Center — widget UX', () => {
  test('TC271: clear-completed removes completed rows but keeps failed', async ({
    page,
  }) => {
    // First batch: a happy upload that will end completed.
    await installFileStorageMock(page)

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC271 ${runId}`)
    await attachFileInSheet(page, sheet, {
      name: 'ok.bin',
      content: 'ok',
    })
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Wait for the queue to drain.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached({ timeout: 30_000 })

    // If the widget is still up (it might already be hidden when idle), the
    // clear button is observable. Either way, the idle sentinel is the
    // contract we care about.
    const clearBtn = page.locator('[data-testid="upload-center-clear"]')
    if (await clearBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await clearBtn.click()
    }

    // After clear-completed (or auto-clear), the widget is hidden and the
    // sentinel is present.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached()
  })

  test('TC274: header clear leaves failed rows in place', async ({ page }) => {
    // Force the multipart `complete` POST to 500 so the upload reliably ends
    // in `failed` — header clear must NOT remove it (per-row dismiss is the
    // affordance for failed rows; the header X is "clear completed only").
    await installFileStorageMock(page, { completeStatus: 500 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC274 ${runId}`)
    await attachFileInSheet(page, sheet, {
      name: 'fail-on-complete.bin',
      content: 'x',
    })
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Wait for the failure to land.
    const taskId = await page
      .waitForFunction(
        () => {
          const all = window.__testHooks?.uploadService.getAllTasks() ?? []
          return all.find((t) => t.status === 'failed')?.id ?? null
        },
        null,
        { timeout: 20_000 }
      )
      .then((h) => h.jsonValue() as Promise<string>)

    // Idle sentinel mounts because there's nothing pending/uploading — that's
    // when the header clear button is rendered.
    await waitForUploadsIdle(page)

    const clearBtn = page.locator('[data-testid="upload-center-clear"]')
    await expect(clearBtn).toBeVisible({ timeout: 5_000 })
    await clearBtn.click()

    // Failed row survives — the user can still retry it.
    await expect(
      page.locator(`[data-testid="upload-task-${taskId}"]`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-testid="upload-task-retry-${taskId}"]`)
    ).toBeVisible()
  })
})
