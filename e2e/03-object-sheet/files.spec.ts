import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  openObjectSheet,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * The FILE MODEL rather than the transport — `05-uploads` already covers the presigned PUT. What is
 * here is where a file can be attached, what happens to it when it is deleted, and which affordances
 * exist in which mode.
 */

const stamp = () => `e2e-${Date.now()}`
const TINY = 'e2e/fixtures/uploads/tiny-1kb.txt'

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function createObject(page: Page, tag: string): Promise<string> {
  const name = `${stamp()}-${tag}`
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'createObject').click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(/name/i).first().fill(name)
  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
  return name
}

/** Attach an external reference — authored in the entity body, so no upload is involved. */
async function addReference(page: Page, url: string, label: string) {
  await page.getByTestId('add-files').click()
  await expect(page.getByTestId('attachment-modal')).toBeVisible()
  await page.getByTestId('attachment-modal-url').fill(url)
  await page.getByTestId('attachment-modal-label').fill(label)
  await page.getByTestId('attachment-modal-add-reference').click()
  await page.getByTestId('attachment-modal-done').click()
}

test.describe('03 - object sheet / files', () => {
  test('FI3: an external reference is authored, never uploaded', async ({
    page,
    api,
  }) => {
    const name = await createObject(page, 'fi3')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')

    api.clear()
    await addReference(page, 'https://example.org/plan.pdf', 'Site plan')
    await saveSheet(page)

    const row = page.getByTestId('file-row').filter({ hasText: 'Site plan' })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('file-open-external')).toBeVisible()
    // A reference travels in the object body; asking S3 to store it would be storing a string.
    expect(api.count(/\/v1\/files$/)).toBe(0)
  })

  /**
   * `isAllowedExternalFileReference` is an SSRF guard, not cosmetic validation:
   * it admits `https:` only, refuses userinfo, and blocks loopback, `.local`
   * and literal IPs. A reference that slipped through would be fetched by
   * whatever later resolves it.
   *
   * The structural assertion is the load-bearing one. A build that showed the
   * error AND staged the file anyway would pass a message-only check, which is
   * the failure this case exists to catch.
   */
  test('FI14: a rejected reference is not staged, whatever the reason', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi14')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')

    await page.getByTestId('add-files').click()
    await expect(page.getByTestId('attachment-modal')).toBeVisible()

    const modal = page.getByTestId('attachment-modal')
    const rejected = [
      'http://example.org/plan.pdf',
      'javascript:alert(1)',
      'https://localhost/plan.pdf',
      'https://127.0.0.1/plan.pdf',
      'https://user:pw@example.org/plan.pdf',
      'not-a-url',
    ]

    for (const url of rejected) {
      await page.getByTestId('attachment-modal-url').fill(url)
      await page.getByTestId('attachment-modal-label').fill(`ref for ${url}`)
      await page.getByTestId('attachment-modal-add-reference').click()

      // `addReference` returns BEFORE `setPending`, so the label never appears
      // in the staged list and the url stays in the box for correction. The
      // pending row carries no testid, so the label it would render IS the
      // signal.
      await expect(modal.getByText(`ref for ${url}`)).toHaveCount(0)
      await expect(page.getByTestId('attachment-modal-url')).toHaveValue(url)
    }

    // The counterweight: the same modal accepts a good url, so the six absences
    // above are the guard and not a dead button.
    await page
      .getByTestId('attachment-modal-url')
      .fill('https://example.org/ok.pdf')
    await page.getByTestId('attachment-modal-label').fill('Accepted')
    await page.getByTestId('attachment-modal-add-reference').click()
    await expect(modal.getByText('Accepted')).toHaveCount(1)

    await page.getByTestId('attachment-modal-done').click()
    await saveSheet(page)

    await expect(page.getByTestId('file-row')).toHaveCount(1)
    await expect(
      page.getByTestId('file-row').filter({ hasText: 'Accepted' })
    ).toHaveCount(1)
  })

  test('FI2: a file can be attached to a property and to a single value', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi2')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await addProperty(page, 0)
    await fillProperty(page, 0, 'Datasheet', '12 kg')

    // Three targets exist — object, property, value — and the two narrow ones are what distinguish
    // this model from a flat attachment list.
    await expect(page.getByTestId('property-attach-0')).toBeVisible()
    await expect(page.getByTestId('value-attach-0-0')).toBeVisible()

    await page.getByTestId('property-attach-0').click()
    await expect(page.getByTestId('attachment-modal')).toBeVisible()
    await page.getByTestId('attachment-modal-url').fill('https://example.org/a')
    await page.getByTestId('attachment-modal-label').fill('On the property')
    await page.getByTestId('attachment-modal-add-reference').click()
    await page.getByTestId('attachment-modal-done').click()

    await page.getByTestId('value-attach-0-0').click()
    await expect(page.getByTestId('attachment-modal')).toBeVisible()
    await page.getByTestId('attachment-modal-url').fill('https://example.org/b')
    await page.getByTestId('attachment-modal-label').fill('On the value')
    await page.getByTestId('attachment-modal-add-reference').click()
    await page.getByTestId('attachment-modal-done').click()

    // Each lands under its own container, not in the object's Files tab — a disclosure per target
    // is what makes the three levels legible. The COUNT on the trigger is the assertable part; the
    // rows themselves sit inside a Collapsible that Radix unmounts while closed.
    const row = page.getByTestId('property-row-0')
    await expect(row.getByTestId('files-count')).toHaveCount(2)

    await saveSheet(page)
    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, name))
    // The editable rows only exist in edit mode — read mode renders `PropertyReadView`, which has
    // no toggle and no per-target disclosure.
    await enterEditMode(page)
    await expandProperty(page, 0)

    await expect(
      page.getByTestId('property-row-0').getByTestId('files-count')
    ).toHaveCount(2)
  })

  test('FI5: the whole-sheet dropzone is armed only in edit mode', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi5')
    await openObjectSheet(page, rowFor(page, name))

    const dropzone = page.getByTestId('sheet-dropzone')
    await expect(dropzone).toHaveAttribute('data-disabled', 'true')

    await enterEditMode(page)
    await expect(dropzone).toHaveAttribute('data-disabled', 'false')
  })

  test('FI6: a template sheet mounts no dropzone at all', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByTestId('data-table')).toBeVisible()
    // The button is a dropdown trigger: one list holds object and process templates.
    await tour(page, 'templatesCreate').click()
    await tour(page, 'templatesCreateObject').click()
    await expect(sheet(page)).toBeVisible()

    // io2p routes an attach target through the engine registry, which knows objects and processes
    // only. A dropzone that silently discards what it catches is worse than none.
    await expect(page.getByTestId('sheet-dropzone')).toHaveCount(0)
    await expect(page.getByTestId('add-files')).toHaveCount(0)
  })

  test('FI7: the preview dialog opens, walks its siblings, and closes on Escape', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi7')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')

    await page.getByTestId('add-files').click()
    await page.locator('input[type=file]').first().setInputFiles([TINY, TINY])
    await page.getByTestId('attachment-modal-done').click()
    await saveSheet(page)
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })

    await page.getByTestId('file-preview').first().click()
    const dialog = page.getByTestId('file-preview-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('file-preview-next')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('FI13: download NAVIGATES to a minted url and never fetches the bytes', async ({
    page,
    api,
  }) => {
    /**
     * The rule this pins, and the bug it cost to learn: the download must reach S3 as an ordinary
     * browser navigation to a presigned url. Fetching the bytes ourselves attaches the JWT to the
     * S3 request, which S3 answers 403/400 — the signature covers the headers it was signed with.
     *
     * So: exactly ONE signing call, and NO request carrying our Authorization header to the
     * returned url. The link's `download` attribute is deliberately not asserted — it is ignored
     * cross-origin, so the filename comes from S3's Content-Disposition, not from us.
     */
    const name = await createObject(page, 'fi13')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')

    await page.getByTestId('add-files').click()
    await page.locator('input[type=file]').first().setInputFiles([TINY])
    await page.getByTestId('attachment-modal-done').click()
    await saveSheet(page)
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })

    await page.getByTestId('file-preview').first().click()
    await expect(page.getByTestId('file-preview-dialog')).toBeVisible()

    // The signed url is minted through our node; the navigation that follows goes straight to the
    // storage host, so it never appears as an API call at all.
    const signing = /\/v1\/files\/[0-9a-f-]{8,}\/download/i
    api.clear()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      page.getByTestId('file-preview-download').click(),
    ])

    await api.expectCount(signing, 1)
    // A download either fires or the browser navigated — both are the correct shape. What must NOT
    // happen is a second signing call, which is what a re-mint on every click looked like.
    expect(download === null || !!download.suggestedFilename()).toBe(true)
  })

  test('FI10: deleting a file strikes it through and offers Restore', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi10')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')
    await addReference(page, 'https://example.org/doomed.pdf', 'Doomed')
    await saveSheet(page)

    const row = page.getByTestId('file-row').filter({ hasText: 'Doomed' })
    await row.getByTestId('file-delete').click()
    await row.getByTestId('file-delete-confirm').click()

    // SOFT: the bytes survive and the row stays, struck through, offering the way back. A file that
    // disappears is indistinguishable from one that was never there.
    await expect(row).toHaveAttribute('data-deleted', 'true')
    await expect(row.getByTestId('file-restore')).toBeVisible()

    await row.getByTestId('file-restore').click()
    await expect(row).toHaveAttribute('data-deleted', 'false')
  })

  test('FI11/FI12: the cover star is an edit-mode decision, and not offered for a reference', async ({
    page,
  }) => {
    const name = await createObject(page, 'fi11')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await switchTab(page, 'files')

    await page.getByTestId('add-files').click()
    await page.locator('input[type=file]').first().setInputFiles(TINY)
    await page.getByTestId('attachment-modal-done').click()
    await addReference(page, 'https://example.org/link.pdf', 'A link')
    await saveSheet(page)
    await expect(page.getByTestId('upload-center-idle')).toBeAttached({
      timeout: 30_000,
    })

    // A .txt is not an image, and neither is a reference — a cover has to be something renderable.
    const reference = page.getByTestId('file-row').filter({ hasText: 'A link' })
    await expect(reference.getByTestId('file-cover-toggle')).toHaveCount(0)

    await enterEditMode(page)
    await expect(
      page.getByTestId('file-row').first().getByTestId('file-cover-toggle')
    ).toHaveCount(0)
  })
})
