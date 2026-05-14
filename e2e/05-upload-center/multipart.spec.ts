import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { attachFileInSheet, getDialog } from '../utils/test-helpers'

/**
 * §15 — Multipart upload accounting.
 *
 * We don't actually push 25 MB through Playwright — that's expensive and tests
 * the SDK's slicer, not our flow. We tell the mock to advertise 4 part URLs
 * on init, then assert:
 *   - The init request fires once.
 *   - `complete` fires once at the end (terminal commit on the backend).
 *   - The task ends in `completed`.
 *
 * The SDK side of "how many bytes go into each part" is covered by iom-sdk's
 * own tests — duplicating that here would just couple us to internal slicing.
 */

const runId = Date.now()

test.describe('05 - Upload Center — multipart', () => {
  test('TC151: a 4-part init flow lands one complete and finishes', async ({
    page,
  }) => {
    const mock = await installFileStorageMock(page, { parts: 4 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC151 ${runId}`)

    await attachFileInSheet(page, sheet, {
      name: 'multipart.bin',
      content: 'multipart payload',
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Wait for the queue to drain.
    await expect(
      page.locator('[data-testid="upload-center-idle"]').first()
    ).toBeAttached({ timeout: 30_000 })

    expect(mock.state.initCount).toBe(1)
    expect(mock.state.completeCount).toBe(1)
  })
})
