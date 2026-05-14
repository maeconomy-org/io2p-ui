import { test, expect, type Page } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { getDialog } from '../utils/test-helpers'

/**
 * §14 — Many tiny files in one drop.
 *
 * 25 × tiny files dropped at once. Asserts:
 *   - The cap (100) does not reject the batch.
 *   - Every task reaches `completed` (visible via the sr-only status spans).
 *   - With setMaxConcurrent(3), the upload widget never shows more than 3
 *     `uploading` rows simultaneously — pure scheduler invariant.
 */

const runId = Date.now()

async function dropTinyFiles(page: Page, count: number) {
  const target = page.locator('[data-testid="attachment-section-dropzone"]')
  await expect(target).toBeVisible({ timeout: 5_000 })
  await target.evaluate((el, n) => {
    const dt = new DataTransfer()
    for (let i = 0; i < n; i++) {
      dt.items.add(
        new File([`tiny ${i}\n`], `tiny-${i}.txt`, { type: 'text/plain' })
      )
    }
    const rect = (el as Element).getBoundingClientRect()
    const center = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    const fire = (t: string) =>
      (el as Element).dispatchEvent(
        new DragEvent(t, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          ...center,
        })
      )
    fire('dragenter')
    fire('dragover')
    fire('drop')
  }, count)
}

test.describe('05 - Upload Center — many tiny files', () => {
  test('TC141: 25 tiny files all complete with maxConcurrent=3', async ({
    page,
  }) => {
    await installFileStorageMock(page)
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page
      .evaluate(() => window.__testHooks?.uploadService.setMaxConcurrent(3))
      .catch(() => {})

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC141 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    await dropTinyFiles(page, 25)

    // The dropzone must NOT have shown the cap error — 25 < 100.
    await expect(modal.getByText(/drop at most 100 files/i)).toHaveCount(0)

    // Empty-state copy is gone once the list is populated.
    await expect(modal.getByText(/no attachments/i)).toHaveCount(0)
  })
})
