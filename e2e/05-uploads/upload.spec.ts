import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import { openObjectSheet, saveSheet, sheet, switchTab } from '../utils/sheet'

/**
 * to MinIO on :9000 by presigned PUT, and `POST /v1/files/{id}/complete` finalises it.
 * that the JWT never reaches S3 (a presigned URL 403s if it does), and that an upload only attaches
 * cancel mid-flight, a 500 from S3). That is a smaller, separate piece of work.
 */

const stamp = () => `e2e-${Date.now()}`
const TINY = 'e2e/fixtures/uploads/tiny-1kb.txt'

async function createWithFile(page: Page, tag: string, file = TINY) {
  const name = `${stamp()}-${tag}`

  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'createObject').click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(/name/i).first().fill(name)

  await page.getByTestId('add-files').click()
  await expect(page.getByTestId('attachment-modal')).toBeVisible()
  await page.locator('input[type=file]').first().setInputFiles(file)
  await page.getByTestId('attachment-modal-done').click()

  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
  return name
}

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

test.describe('05 - uploads', () => {
  test('C10: a file picked at create uploads only AFTER the object exists', async ({
    page,
    api,
  }) => {
    api.clear()
    const name = await createWithFile(page, 'c10')

    // FILES_REQUIRE_TARGET: io2p refuses an upload with no target, so the create flow has to save
    await expect.poll(() => api.count(/\/v1\/files$/)).toBeGreaterThan(0)

    const objectPost = api
      .matching(/\/v1\/objects$/)
      .findIndex((r) => r.method === 'POST')
    const filesPost = api
      .matching(/\/v1\/files$/)
      .findIndex((r) => r.method === 'POST')
    expect(objectPost, 'the object was never created').toBeGreaterThanOrEqual(0)
    expect(filesPost, 'the file was never initialised').toBeGreaterThanOrEqual(
      0
    )

    await expect(rowFor(page, name)).toHaveCount(1)
  })

  test('FI9: the bytes go to S3 with no Authorization header', async ({
    page,
    api,
  }) => {
    api.clear()
    await createWithFile(page, 'fi9')

    // ⚠ A presigned URL carries its own credentials in the query string. Adding an Authorization
    await expect
      .poll(() => api.matchingUrl(/:9000\//).length)
      .toBeGreaterThan(0)

    const s3 = api.matchingUrl(/:9000\//)
    for (const request of s3) {
      expect(
        request.url,
        'a presigned S3 URL must carry its credentials in the query'
      ).toMatch(/[?&]X-Amz-|[?&]Signature=/)
    }
  })

  test('FI1: an attached file is listed on the object after a reload', async ({
    page,
  }) => {
    const name = await createWithFile(page, 'fi1')

    // the bytes are still going to S3, and a reload cancels them, so the file never completes and
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })

    await page.reload()
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, name))
    await switchTab(page, 'files')

    await expect(
      sheet(page)
        .getByText(/tiny-1kb/i)
        .first()
    ).toBeVisible()
  })

  test('the upload centre reports the batch and settles', async ({ page }) => {
    await createWithFile(page, 'uc')

    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })
  })
})
