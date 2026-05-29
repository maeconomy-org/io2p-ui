import { test, expect, type Route } from '@playwright/test'

import { attachFileInSheet, getDialog, openObject } from '../utils/test-helpers'

/**
 * Attachment preview lightbox.
 *
 * Exercises the user-facing flow added in the Richer Attachment Preview v1:
 * open via the Eye button, display of the file name, close via the X button
 * and Escape, keyboard navigation across siblings, and the top-bar download
 * button triggering a real blob-URL download.
 */

const runId = Date.now()

const PREVIEW_DIALOG = '[data-testid="attachment-preview-dialog"]'
const DOWNLOAD_BTN = '[data-testid="attachment-preview-download"]'
const NEXT_BTN = '[data-testid="attachment-preview-next"]'
const PREV_BTN = '[data-testid="attachment-preview-prev"]'

async function createObjectWithFiles(
  page: import('@playwright/test').Page,
  name: string,
  files: { name: string; content?: string; mime?: string }[]
) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible()

  await sheet.getByLabel('Name').fill(name)

  for (const f of files) {
    await attachFileInSheet(page, sheet, f)
  }

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15000 })
}

async function openFilesTab(
  page: import('@playwright/test').Page,
  objectName: string
) {
  await openObject(page, objectName)
  await page.getByRole('tab', { name: /files/i }).click()
}

test.describe('17 - Attachment Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC121: opens the preview dialog from the files tab', async ({
    page,
  }) => {
    const name = `TC121 Preview ${runId}`
    await createObjectWithFiles(page, name, [
      { name: 'preview-me.txt', content: 'hello world from e2e' },
    ])

    await openFilesTab(page, name)

    const previewBtn = page.locator('[data-testid^="file-preview-"]').first()
    await expect(previewBtn).toBeVisible({ timeout: 15000 })
    await previewBtn.click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText('preview-me.txt').first()).toBeVisible()
  })

  test('TC122: closes via the X button and reopens without stale state', async ({
    page,
  }) => {
    const name = `TC122 Preview ${runId}`
    await createObjectWithFiles(page, name, [
      { name: 'closeable.txt', content: 'close me' },
    ])

    await openFilesTab(page, name)

    const previewBtn = page.locator('[data-testid^="file-preview-"]').first()
    await previewBtn.click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()

    // Close via the toolbar X (aria-label is the "common.close" translation).
    await dialog.getByRole('button', { name: /close/i }).click()
    await expect(dialog).toBeHidden({ timeout: 5000 })

    // Reopen — should work without reloading the page.
    await previewBtn.click()
    await expect(dialog).toBeVisible()
  })

  test('TC123: closes via Escape', async ({ page }) => {
    const name = `TC123 Preview ${runId}`
    await createObjectWithFiles(page, name, [
      { name: 'escapable.txt', content: 'escape me' },
    ])

    await openFilesTab(page, name)
    await page.locator('[data-testid^="file-preview-"]').first().click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5000 })
  })

  test('TC124: download button triggers a browser download with the file name', async ({
    page,
  }) => {
    const name = `TC124 Preview ${runId}`
    const fileName = 'downloadable.txt'
    await createObjectWithFiles(page, name, [
      { name: fileName, content: 'download payload' },
    ])

    await openFilesTab(page, name)

    // The SDK's `getDownloadUrl` does an authenticated GET to
    // `/api/FileStorage/{ref}/download` and returns JSON `{ url, expiresAt }` —
    // a presigned S3 URL with `Content-Disposition: attachment` baked in (see
    // iom-sdk/.../file-storage-client.ts). Cross-origin browsers ignore the
    // `<a download>` attribute, so we point the returned `url` at a same-origin
    // stub that returns `Content-Disposition: attachment`; the download event
    // then fires reliably and `suggestedFilename` reflects the header.
    // `preview-url` is mocked too so the text preview renders in the dialog.
    await page.route(`**/__test_download/${fileName}`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
        contentType: 'text/plain',
        body: 'download payload',
      })
    )
    const signedUrlResponse = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `/__test_download/${fileName}`,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
    await page.route('**/api/FileStorage/*/preview-url', signedUrlResponse)
    await page.route('**/api/FileStorage/*/download', signedUrlResponse)

    await page.locator('[data-testid^="file-preview-"]').first().click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator(DOWNLOAD_BTN).click(),
    ])

    expect(download.suggestedFilename()).toBe(fileName)
  })

  test('TC125: navigates between siblings via the next/prev buttons', async ({
    page,
  }) => {
    const name = `TC125 Preview ${runId}`
    const names = ['one.txt', 'two.txt', 'three.txt']
    await createObjectWithFiles(page, name, [
      { name: names[0], content: 'first' },
      { name: names[1], content: 'second' },
      { name: names[2], content: 'third' },
    ])

    await openFilesTab(page, name)
    await page.locator('[data-testid^="file-preview-"]').first().click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()

    // File ordering in the files tab is not guaranteed to match upload order,
    // so assert navigation cycles through distinct sibling names rather than
    // a specific sequence. The toolbar's truncate <p> holds the active name.
    const toolbarName = dialog.locator('p.truncate').first()
    const seen: string[] = []
    seen.push((await toolbarName.textContent())?.trim() || '')

    await dialog.locator(NEXT_BTN).click()
    await expect(toolbarName).not.toHaveText(seen[0]!, { timeout: 5000 })
    seen.push((await toolbarName.textContent())?.trim() || '')

    await dialog.locator(NEXT_BTN).click()
    await expect
      .poll(async () => (await toolbarName.textContent())?.trim())
      .not.toBe(seen[1]!)
    seen.push((await toolbarName.textContent())?.trim() || '')

    // All three siblings visited.
    expect(new Set(seen).size).toBe(3)
    for (const n of names) expect(seen).toContain(n)

    // Wrap around: Next from the last lands on the first.
    await dialog.locator(NEXT_BTN).click()
    await expect(toolbarName).toHaveText(seen[0]!, { timeout: 5000 })

    // Prev wraps back to the last.
    await dialog.locator(PREV_BTN).click()
    await expect(toolbarName).toHaveText(seen[2]!, { timeout: 5000 })
  })

  test('TC126: navigates between siblings via arrow keys', async ({ page }) => {
    const name = `TC126 Preview ${runId}`
    await createObjectWithFiles(page, name, [
      { name: 'alpha.txt', content: 'a' },
      { name: 'beta.txt', content: 'b' },
    ])

    await openFilesTab(page, name)
    await page.locator('[data-testid^="file-preview-"]').first().click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()

    // Order-agnostic: just verify ArrowRight cycles to the other sibling and
    // ArrowLeft returns. The files tab does not guarantee upload-order.
    const toolbarName = dialog.locator('p.truncate').first()
    const initial = (await toolbarName.textContent())?.trim() || ''
    expect(['alpha.txt', 'beta.txt']).toContain(initial)

    await page.keyboard.press('ArrowRight')
    await expect(toolbarName).not.toHaveText(initial, { timeout: 5000 })

    await page.keyboard.press('ArrowLeft')
    await expect(toolbarName).toHaveText(initial, { timeout: 5000 })
  })

  test('TC127: hides the prev/next controls when only one sibling is previewable', async ({
    page,
  }) => {
    const name = `TC127 Preview ${runId}`
    await createObjectWithFiles(page, name, [
      { name: 'solo.txt', content: 'only one' },
    ])

    await openFilesTab(page, name)
    await page.locator('[data-testid^="file-preview-"]').first().click()

    const dialog = page.locator(PREVIEW_DIALOG)
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(NEXT_BTN)).toHaveCount(0)
    await expect(dialog.locator(PREV_BTN)).toHaveCount(0)
  })
})
