import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  enterEditMode,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * The cover thumbnail, and the claim that hovering one costs nothing.
 *
 * One 320px thumbnail serves BOTH the row and the enlarged hover card. A preview that reached for
 * the full-size file would mint a signed URL per hovered row, which is a cost the list pays
 * silently — so the assertion is that the two `src` values are identical, not merely that a
 * preview appears.
 *
 * This SEEDS its own cover rather than hoping one is on page 1. The case lived in
 * `chrome.read.spec.ts` behind `test.skip((await thumb.count()) === 0)` and skipped on most runs
 * while reporting as covered; a `read` spec creates nothing, so it could never have arranged the
 * state it needed.
 */

const COVER = 'e2e/fixtures/uploads/cover-8px.png'

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

test.describe('02 - objects list / the cover image', () => {
  test('L18: hovering a thumbnail enlarges the SAME image, minting nothing', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000)
    const name = `e2e-${Date.now()}-cover`

    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    // Attach the image, then mark it the cover — `coverFileId` is a root attribute set in edit
    // mode, so the file has to exist on the object first.
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')
    await page.getByTestId('add-files').click()
    await page.locator('input[type=file]').first().setInputFiles(COVER)
    await page.getByTestId('attachment-modal-done').click()
    await saveSheet(page)
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })

    await enterEditMode(page)
    await switchTab(page, 'files')
    const star = page
      .getByTestId('file-row')
      .first()
      .getByTestId('file-cover-toggle')
    await expect(star).toBeVisible()
    await star.click()
    await saveSheet(page)
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })
    await page.keyboard.press('Escape')

    // Sorted newest-first is not guaranteed, so find the row rather than taking the first.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    const row = rowFor(page, name)
    await expect(row).toBeVisible()

    const thumb = row.getByTestId('cover-thumb')
    await expect(thumb).toBeVisible({ timeout: 30_000 })
    const src = await thumb.locator('img').getAttribute('src')

    await thumb.hover()
    const preview = page.getByTestId('cover-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute('src', src ?? '')
  })
})
