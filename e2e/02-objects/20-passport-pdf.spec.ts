import { test, expect, type Page } from '@playwright/test'

import { getDialog } from '../utils/test-helpers'

/**
 * Passport PDF download
 *
 * Smoke test for the server-rendered product passport PDF. Creates a minimal
 * object, opens its passport sheet, clicks Download PDF, and verifies the
 * browser fires a real download event with a `.pdf` filename and a non-empty
 * payload. The full visual fidelity is exercised by the unit test that calls
 * `renderToBuffer` directly — here we just guard the wiring: QR generation,
 * the `/api/passport/[uuid]/pdf` round-trip, and the anchor-click handoff.
 */

const runId = Date.now()

async function createMinimalObject(page: Page, name: string) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })
  await sheet.getByLabel('Name').fill(name)
  await sheet.getByLabel('Abbreviation').fill('PDF')
  await sheet
    .getByLabel('Description')
    .fill('Fixture for passport PDF download e2e.')
  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
}

async function openPassport(page: Page, name: string) {
  const row = page.getByRole('row', { name: new RegExp(name) }).first()
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator('[data-testid="object-actions-dropdown"]').click()
  await page.locator('[data-testid="object-action-view-passport"]').click()
  const sheet = page.locator('[data-testid="product-passport-sheet"]')
  await expect(sheet).toBeVisible({ timeout: 5000 })
  return sheet
}

test.describe('20 - Passport PDF download', () => {
  test('downloads a non-empty PDF when the user clicks Download PDF', async ({
    page,
  }) => {
    const name = `TC-PASSPORT-PDF ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await createMinimalObject(page, name)
    await openPassport(page, name)

    const downloadButton = page.locator(
      '[data-testid="passport-download-pdf-button"]'
    )
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeEnabled()

    // The pipeline is: client generates a QR PNG with `qr-code-styling`,
    // POSTs the passport payload to `/api/passport/[uuid]/pdf`, the server
    // renders the PDF and streams it back, the client wraps the blob in
    // an anchor and clicks it. `waitForEvent('download')` resolves on that
    // anchor click — so a passing assertion proves every hop succeeded.
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await downloadButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    expect(download.suggestedFilename()).toContain('passport-')

    // Read the downloaded payload and assert the PDF magic header. This is
    // the cheapest "is it actually a PDF?" check — Acrobat, Preview, and
    // every PDF parser look for these exact five bytes.
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)
    expect(buffer.byteLength).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })
})
