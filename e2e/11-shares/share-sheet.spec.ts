import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'

/**
 * The per-item Share sheet — the one reached from a row menu, as opposed to the `/shares` bundle
 * editor that `editor.spec.ts` covers.
 *
 * Its defining property is that NOTHING is written while you edit. Adding a person, changing a rung
 * and ticking cascade all mutate a local draft; Save diffs it and issues only the calls that differ.
 * Granting the moment a name is picked means a mis-click IS already someone's access, undoable only
 * by a second write — so "the picker fired no grant" is the assertion that matters here.
 */

const second = secondCredentials()

function openShareFor(page: Page, prefix: string) {
  return async () => {
    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId(`${prefix}-actions-dropdown`).click()
    await page.getByTestId(`${prefix}-action-share`).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  }
}

test.describe('11 - shares / the per-item sheet', () => {
  test('SS1: it opens on an object and lists who already has access', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await openShareFor(page, 'object')()

    // The owner row is unconditional — it is the one member every resource has.
    await expect(page.getByRole('dialog')).toContainText(/owner/i)
  })

  test('SS2: picking a person writes NOTHING until Save', async ({
    page,
    api,
  }) => {
    test.skip(
      !second,
      'set E2E_EMAIL_2 in .env.local — the picker needs someone to find'
    )
    // ITS OWN object, not whatever happens to be newest. `openShareFor` takes
    // `data-table-row.first()`, and the picker excludes anyone already in the draft
    // (`candidates = users.filter((u) => !draft[u.id])`) — so the newest object having a member
    // makes the picker return nothing and this case fails 15s later on an option that cannot
    // appear. That is a default being asserted: no run guarantees the newest object is unshared,
    // because the previous run created it. Measured — `11-shares/revoked-history.spec.ts` ends with
    // a live grant on the object it creates, and this case went red the moment that file existed.
    const objectName = `e2e-${Date.now()}-ss2`
    await createObjectWithId(page, objectName)

    await page.goto('/objects')
    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: objectName })
      .first()
    await expect(row).toBeVisible()
    await row.getByTestId('object-actions-dropdown').click()
    await page.getByTestId('object-action-share').click()
    await expect(page.getByRole('dialog')).toBeVisible()

    api.clear()
    // The picker uses `shouldFilter={false}` and searches the SERVER, so an
    // empty box offers nobody — this skipped every run until the query was
    // typed, and reported as covered.
    await page.getByTestId('share-add-people').click()
    await page.getByPlaceholder(/search/i).fill(second!.email)

    const option = page.getByRole('option').first()
    await expect(option).toBeVisible({ timeout: 15_000 })
    await option.click()

    // The staged row is on screen. Named, because the people-picker popover is
    // ALSO `role="dialog"` and an unnamed one is a strict-mode violation the
    // moment the picker opens.
    await expect(
      page
        .getByRole('dialog', { name: /share/i })
        .getByTestId('share-sheet-save')
    ).toBeVisible()
    // …and not a single grant has gone out. A picker that wrote on select would already have
    // given this person access, and only a second write could take it back.
    await api.expectCount(/\/v1\/access\/grants/, 0)
  })

  test('SS3: Save stays inert while the draft matches the server', async ({
    page,
    api,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await openShareFor(page, 'object')()

    api.clear()
    const save = page.getByRole('button', { name: /^save$/i })
    await expect(save).toBeDisabled()
    await api.expectCount(/\/v1\/access\/grants/, 0)
  })

  test('SS4: a library item says it can only be shared read-only', async ({
    page,
  }) => {
    // READ_SHARE_ONLY is enforced in the node's rules layer, so offering the permission ladder
    // would render choices the node refuses. The sheet says so instead.
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId('formula-actions-dropdown').click()

    const share = page.getByTestId('formula-action-share')
    test.skip(
      (await share.count()) === 0,
      'the first formula is not owned by this account'
    )
    await share.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText(/only be shared/i)
  })

  test('SS5: the sheet offers general access, and a library item does not cascade', async ({
    page,
  }) => {
    // `includeDescendants` is an ancestor walk at check time, so it means something only for a
    // resource that HAS descendants — the node rejects it for a formula. The public toggle is
    // unconditional, which makes it the one control that must be on screen either way.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await openShareFor(page, 'object')()
    await expect(page.getByRole('dialog')).toContainText(/anyone signed in/i)

    await page.keyboard.press('Escape')
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId('formula-actions-dropdown').click()
    const share = page.getByTestId('formula-action-share')
    test.skip(
      (await share.count()) === 0,
      'the first formula is not owned by this account'
    )
    await share.click()

    // No descendants, so no cascade hint anywhere in the sheet.
    await expect(page.getByRole('dialog')).not.toContainText(
      /everything under this object/i
    )
  })
})
