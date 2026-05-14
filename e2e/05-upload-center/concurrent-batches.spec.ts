import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { attachFileInSheet, getDialog } from '../utils/test-helpers'

/**
 * §21 — Concurrent batches (regression for the global-callback hijack bug).
 *
 * The original implementation hijacked `options.onComplete` for the batch's
 * lifetime, so a second `queueFileUploadsWithContext` running concurrently
 * would either steal the first batch's completion event or never resolve at
 * all. After the rewrite, each `addFile` returns its own promise and the
 * batches are completely independent.
 *
 * Here we kick off one upload via object-create, then immediately enqueue a
 * second via a synthesized drag-drop onto the attachment section of a new
 * sheet. Both must reach `completed`.
 */

const runId = Date.now()

test.describe('05 - Upload Center — concurrent batches', () => {
  test('TC211: two batches in flight at once both reach completed', async ({
    page,
  }) => {
    const mock = await installFileStorageMock(page, { initDelayMs: 800 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Batch A.
    await page.getByRole('button', { name: /create object/i }).click()
    const sheetA = getDialog(page, 'Add Object')
    await expect(sheetA).toBeVisible({ timeout: 5_000 })
    await sheetA.getByLabel('Name').fill(`TC211-A ${runId}`)
    await attachFileInSheet(page, sheetA, {
      name: 'a.bin',
      content: 'A payload',
    })
    await sheetA.getByRole('button', { name: 'Create' }).click()
    await expect(sheetA).toBeHidden({ timeout: 15_000 })

    // Batch B starts while A is still parked on initDelayMs.
    await page.getByRole('button', { name: /create object/i }).click()
    const sheetB = getDialog(page, 'Add Object')
    await expect(sheetB).toBeVisible({ timeout: 5_000 })
    await sheetB.getByLabel('Name').fill(`TC211-B ${runId}`)
    await attachFileInSheet(page, sheetB, {
      name: 'b.bin',
      content: 'B payload',
    })
    await sheetB.getByRole('button', { name: 'Create' }).click()
    await expect(sheetB).toBeHidden({ timeout: 15_000 })

    // Both batches must drain — the upload-center idle sentinel re-attaches
    // only when every task has terminated.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached({ timeout: 30_000 })

    // Each batch had one file → 2 init + 2 complete calls.
    expect(mock.state.initCount).toBeGreaterThanOrEqual(2)
    expect(mock.state.completeCount).toBeGreaterThanOrEqual(2)
  })
})
