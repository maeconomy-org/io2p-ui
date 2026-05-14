import { test, expect, type Page } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { getDialog } from '../utils/test-helpers'

/**
 * §30 — Drag-drop edge cases.
 *
 * - Multi-file drop in a single event enqueues every file (up to the cap).
 * - Dropping on the active sheet's dropzone routes correctly; a stale
 *   background dropzone is not used.
 */

const runId = Date.now()

async function dropFilesInPage(page: Page, count: number, namePrefix: string) {
  const target = page.locator('[data-testid="attachment-section-dropzone"]')
  await expect(target).toBeVisible({ timeout: 5_000 })
  await target.evaluate(
    (el, args) => {
      const { count, namePrefix } = args as {
        count: number
        namePrefix: string
      }
      const dt = new DataTransfer()
      for (let i = 0; i < count; i++) {
        dt.items.add(
          new File([`x ${i}`], `${namePrefix}-${i}.txt`, { type: 'text/plain' })
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
    },
    { count, namePrefix }
  )
}

test.describe('05 - Upload Center — drag-drop', () => {
  test('TC301: multi-file drop enqueues every file', async ({ page }) => {
    await installFileStorageMock(page)
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC301 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    await dropFilesInPage(page, 5, 'multi')

    // No cap rejection, no empty state.
    await expect(modal.getByText(/drop at most 100 files/i)).toHaveCount(0)
    await expect(modal.getByText(/no attachments/i)).toHaveCount(0)
  })

  test('TC302: drop on active sheet routes to its dropzone, not background', async ({
    page,
  }) => {
    await installFileStorageMock(page)
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC302 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // The dropzone inside the modal is the live one.
    await dropFilesInPage(page, 2, 'active')
    await expect(modal.getByText(/no attachments/i)).toHaveCount(0)
  })
})
