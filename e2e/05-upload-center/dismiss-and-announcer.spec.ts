import { test, expect } from '@playwright/test'

import { installFileStorageMock } from '../helpers/mock-file-storage'
import { getDialog, waitForUploadsIdle } from '../utils/test-helpers'

/**
 * Coverage for the U4 (aria-live announcer) and U10 (per-row dismiss button)
 * UI additions. Pure UI — backend is fully stubbed via the file-storage mock.
 *
 * - TC272: dismiss removes a single completed row, leaves siblings intact
 * - TC273: dismiss is gated to terminal status (no remove button while uploading)
 * - TC274: announcer testid carries the localized completion sentence
 */

const runId = Date.now()

const ANNOUNCER = '[data-testid="upload-center-announcer"]'

test.describe('05 - Upload Center — dismiss + announcer', () => {
  test('TC272: per-row dismiss removes one completed row, keeps siblings', async ({
    page,
  }) => {
    await installFileStorageMock(page)

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC272 ${runId}`)

    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('input[type="file"]').setInputFiles([
      { name: 'keep.txt', mimeType: 'text/plain', buffer: Buffer.from('a') },
      { name: 'drop.txt', mimeType: 'text/plain', buffer: Buffer.from('b') },
    ])
    await page.locator('[data-testid="attachment-modal-done-button"]').click()
    const confirm = page.locator('[data-testid="upload-files-confirm-button"]')
    if (await confirm.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirm.click()
    }
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Wait for both uploads to settle, then look up their ids.
    await waitForUploadsIdle(page)

    const ids = await page.evaluate(() => {
      const tasks = window.__testHooks?.uploadService.getAllTasks() ?? []
      return tasks
        .filter((t) => t.status === 'completed')
        .map((t) => ({ id: t.id, name: t.attachment?.fileName }))
    })
    const drop = ids.find((t) => t.name === 'drop.txt')
    const keep = ids.find((t) => t.name === 'keep.txt')
    expect(drop?.id).toBeTruthy()
    expect(keep?.id).toBeTruthy()

    // Both rows are present before dismiss.
    await expect(
      page.locator(`[data-testid="upload-task-${drop!.id}"]`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-testid="upload-task-${keep!.id}"]`)
    ).toBeVisible()

    await page.locator(`[data-testid="upload-task-remove-${drop!.id}"]`).click()

    // Dismissed row gone, sibling untouched.
    await expect(
      page.locator(`[data-testid="upload-task-${drop!.id}"]`)
    ).toHaveCount(0, { timeout: 3_000 })
    await expect(
      page.locator(`[data-testid="upload-task-${keep!.id}"]`)
    ).toBeVisible()
  })

  test('TC273: dismiss button is hidden while a task is in flight', async ({
    page,
  }) => {
    // Park init so the task stays uploading long enough to assert.
    await installFileStorageMock(page, { initDelayMs: 60_000 })

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC273 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('input[type="file"]').setInputFiles([
      {
        name: 'inflight.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
      },
    ])
    await page.locator('[data-testid="attachment-modal-done-button"]').click()
    const confirm = page.locator('[data-testid="upload-files-confirm-button"]')
    if (await confirm.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirm.click()
    }
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    // Find the in-flight task.
    const id = await page
      .waitForFunction(
        () => {
          const all = window.__testHooks?.uploadService.getAllTasks() ?? []
          const t = all.find(
            (x) => x.status === 'uploading' || x.status === 'pending'
          )
          return t?.id ?? null
        },
        null,
        { timeout: 10_000 }
      )
      .then((h) => h.jsonValue() as Promise<string>)

    // Cancel button present, remove button absent.
    await expect(
      page.locator(`[data-testid="upload-task-cancel-${id}"]`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-testid="upload-task-remove-${id}"]`)
    ).toHaveCount(0)
  })

  test('TC274: announcer carries the completion sentence after a task finishes', async ({
    page,
  }) => {
    await installFileStorageMock(page)

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    await sheet.getByLabel('Name').fill(`TC274 ${runId}`)
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const modal = page.locator('[data-testid="attachment-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('input[type="file"]').setInputFiles([
      {
        name: 'announced.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hi'),
      },
    ])
    await page.locator('[data-testid="attachment-modal-done-button"]').click()
    const confirm = page.locator('[data-testid="upload-files-confirm-button"]')
    if (await confirm.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirm.click()
    }
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15_000 })

    await waitForUploadsIdle(page)

    // The live region must contain the localized completion sentence with the
    // file name interpolated. We assert text not exact equality so a future
    // i18n tweak that adds punctuation/emoji wouldn't break the test.
    await expect(page.locator(ANNOUNCER)).toContainText('announced.txt', {
      timeout: 5_000,
    })
    await expect(page.locator(ANNOUNCER)).toContainText(/complete/i)
  })
})
