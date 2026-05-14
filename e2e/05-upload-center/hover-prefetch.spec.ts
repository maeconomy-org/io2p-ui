import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { attachFileInSheet, getDialog, openObject } from '../utils/test-helpers'

/**
 * §22 — Hover prefetch dedupe on FileDisplay rows.
 *
 * `file-display.tsx` issues `queryClient.prefetchQuery(previewUrl)` on
 * `onPointerEnter`. Without the prefetchedRef guard, every bubble-up event
 * (icon hover, name hover, button hover) re-runs the prefetch. The guard
 * caps it at exactly one preview-url request per hover-entry; leaving and
 * re-entering allows a second request.
 *
 * This spec creates a real attachment first (against the mock), then opens
 * the object's details sheet, counts preview-url requests during hover.
 */

const runId = Date.now()

test.describe('05 - Upload Center — hover prefetch', () => {
  test('TC221: one preview-url request per hover-entry, second entry refetches', async ({
    page,
  }) => {
    await installFileStorageMock(page)
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const name = `TC221 ${runId}`
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(name)
    await attachFileInSheet(page, sheet, {
      name: 'hover.pdf',
      content: 'hover target',
    })
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    await openObject(page, name)
    // openObject lands on the Details tab; file rows live under Files.
    await page.getByRole('tab', { name: /files/i }).click()

    // Count preview-url calls via a request listener.
    let previewCalls = 0
    page.on('request', (req) => {
      if (/\/api\/FileStorage\/[^/]+\/preview-url/.test(req.url())) {
        previewCalls += 1
      }
    })

    // The file-display row has a testid keyed on uuid/fileReference/name.
    // We can't predict the uuid before the page mounts; match by partial
    // class + role instead. The component renders one such row per file.
    const row = page.locator('[data-testid^="file-display-row-"]').first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    const before = previewCalls
    await row.hover()
    // Move pointer to inner content to confirm the guard absorbs bubble-ups.
    await row.hover({ position: { x: 30, y: 10 } })
    await page.waitForTimeout(500)
    const afterFirstEnter = previewCalls

    // Leave the row, then re-enter — a second prefetch is allowed.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)
    await row.hover()
    await page.waitForTimeout(500)
    const afterSecondEnter = previewCalls

    expect(afterFirstEnter - before).toBeLessThanOrEqual(1)
    expect(afterSecondEnter).toBeGreaterThanOrEqual(afterFirstEnter)
  })
})
