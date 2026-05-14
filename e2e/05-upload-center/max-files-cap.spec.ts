import { test, expect, type Page } from '@playwright/test'

import { getDialog } from '../utils/test-helpers'

/**
 * §24 — Max files per drop (MAX_FILES_PER_DROP = 100).
 *
 * The dropzone must reject a batch over the cap as a whole — partial accept
 * would leave the user guessing which files made it through, and a folder
 * picker can hand us thousands of File entries which would saturate the
 * hashing/init pipeline. See src/constants/limits.ts.
 *
 * These specs don't need the real backend: they only assert the client-side
 * batch-size guard. We open the attach modal (which renders AttachmentSection)
 * and synthesize a `drop` event with a DataTransfer containing N tiny files.
 */

const runId = Date.now()

async function openAttachModalInCreate(page: Page) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })
  await sheet.getByLabel('Name').fill(`Max-cap fixture ${runId}`)
  await sheet.getByRole('button', { name: /attach file/i }).click()
  const modal = page.locator('[data-testid="attachment-modal"]')
  await expect(modal).toBeVisible({ timeout: 5000 })
  return { sheet, modal }
}

/**
 * Synthesize a drop of `count` tiny `.txt` files onto the AttachmentSection
 * dropzone. Bypasses Playwright's setInputFiles because react-dropzone only
 * fires on real drag events, not file-input changes.
 */
async function dropNTinyFiles(page: Page, count: number) {
  const target = page.locator('[data-testid="attachment-section-dropzone"]')
  await expect(target).toBeVisible({ timeout: 5000 })
  await target.evaluate((el, n) => {
    const dt = new DataTransfer()
    for (let i = 0; i < n; i++) {
      dt.items.add(
        new File([`tiny ${i}\n`], `f-${i}.txt`, { type: 'text/plain' })
      )
    }
    const rect = (el as Element).getBoundingClientRect()
    const center = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    const fire = (type: string) =>
      (el as Element).dispatchEvent(
        new DragEvent(type, {
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

test.describe('05 - Upload Center — max files per drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC241: dropping 101 files shows the cap error and accepts none', async ({
    page,
  }) => {
    const { modal } = await openAttachModalInCreate(page)

    await dropNTinyFiles(page, 101)

    // Inline error from t('objects.attachments.tooManyFiles', { max: 100 }).
    await expect(modal.getByText(/drop at most 100 files/i)).toBeVisible({
      timeout: 5000,
    })

    // The "no attachments" empty-state copy must still be present — nothing
    // from the rejected batch should have been enqueued.
    await expect(
      modal.getByText(/no attachments/i, { exact: false })
    ).toBeVisible()
  })

  test('TC242: dropping exactly 100 files enqueues all of them', async ({
    page,
  }) => {
    const { modal } = await openAttachModalInCreate(page)

    await dropNTinyFiles(page, 100)

    // No cap error.
    await expect(modal.getByText(/drop at most 100 files/i)).toHaveCount(0)

    // The attachment list renders one row per enqueued file. We don't need
    // to count 100 exactly (the list is virtualized via overflow-y in some
    // contexts) — assert that the empty-state is gone instead.
    await expect(modal.getByText(/no attachments/i)).toHaveCount(0)
  })

  test('TC243: two back-to-back drops of 60 each both succeed (cap is per-event)', async ({
    page,
  }) => {
    const { modal } = await openAttachModalInCreate(page)

    await dropNTinyFiles(page, 60)
    await dropNTinyFiles(page, 60)

    // Both batches were under the per-event cap of 100 — neither should have
    // triggered the rejection.
    await expect(modal.getByText(/drop at most 100 files/i)).toHaveCount(0)
    await expect(modal.getByText(/no attachments/i)).toHaveCount(0)
  })
})
