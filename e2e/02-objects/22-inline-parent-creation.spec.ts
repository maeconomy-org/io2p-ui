import { test, expect } from '@playwright/test'

import { getDialog } from '../utils/test-helpers'

/**
 * Inline parent creation (UI-only).
 *
 * Verifies the depth=1 nested-sheet invariant and the draft-handoff path:
 *   1. Outer picker exposes "+ Create new parent" (default for outer sheets).
 *   2. Clicking it opens a nested ObjectAddSheet stacked above the outer.
 *   3. Inside the nested sheet, the picker DOES NOT show "+ Create new parent"
 *      (depth=1 enforcement).
 *   4. Save-as-draft on the nested sheet hands a draft_* ref back to the outer
 *      picker, which renders the parent with a Draft badge.
 *
 * No backend writes — this spec only exercises the picker / sheet UI and
 * the localStorage-backed drafts store.
 */

const runId = Date.now()

test.describe('22 - Inline parent creation', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('iom-drafts:objects:')) toRemove.push(k)
      }
      toRemove.forEach((k) => localStorage.removeItem(k))
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('Outer picker exposes "+ Create new parent" affordance', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    // Open the parent picker popover.
    await sheet
      .getByRole('combobox')
      .filter({ hasText: /search for parent objects/i })
      .click()

    const popover = page.getByRole('listbox')
    await expect(popover).toBeVisible()
    await expect(
      popover.getByRole('option', { name: /create new parent/i })
    ).toBeVisible()
  })

  test('Depth-1 invariant: nested picker hides the create action', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const outerSheet = getDialog(page, 'Add Object')
    await expect(outerSheet).toBeVisible()

    await outerSheet
      .getByRole('combobox')
      .filter({ hasText: /search for parent objects/i })
      .click()
    await page
      .getByRole('listbox')
      .getByRole('option', { name: /create new parent/i })
      .click()

    // Nested ObjectAddSheet now mounts. Both outer and inner share the same
    // SheetTitle, so target the *last* matching dialog (the topmost one).
    const allSheets = page.getByRole('dialog', { name: /add object/i })
    const nestedSheet = allSheets.last()
    await expect(nestedSheet).toBeVisible()

    // Open the nested sheet's parent picker. The "+ Create new parent" action
    // must NOT appear here (allowInlineCreate=false → depth=1 enforced).
    await nestedSheet
      .getByRole('combobox')
      .filter({ hasText: /search for parent objects/i })
      .click()

    const popover = page.getByRole('listbox')
    await expect(popover).toBeVisible()
    await expect(
      popover.getByRole('option', { name: /create new parent/i })
    ).toHaveCount(0)
  })

  test('Save-as-draft on nested hands a draft_* ref back to outer picker', async ({
    page,
  }) => {
    const nestedDraftName = `Inline Parent ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const outerSheet = getDialog(page, 'Add Object')
    await outerSheet.getByLabel('Name').fill(`Outer Child ${runId}`)

    await outerSheet
      .getByRole('combobox')
      .filter({ hasText: /search for parent objects/i })
      .click()
    await page
      .getByRole('listbox')
      .getByRole('option', { name: /create new parent/i })
      .click()

    const nestedSheet = page.getByRole('dialog', { name: /add object/i }).last()
    await expect(nestedSheet).toBeVisible()
    await nestedSheet.getByLabel('Name').fill(nestedDraftName)

    // Escape the nested sheet → confirm dialog → Save as draft.
    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: /save as draft/i }).click()
    await expect(nestedSheet).toBeHidden()

    // Outer picker's selected-parents strip should now display the nested
    // draft's name with a Draft badge alongside.
    const selectedStrip = outerSheet.locator('.bg-muted\\/20').first()
    await expect(selectedStrip).toContainText(nestedDraftName)
    await expect(
      selectedStrip.getByText(/draft/i, { exact: false })
    ).toBeVisible()
  })

  test('Discard on nested does NOT add a draft ref to the outer picker', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const outerSheet = getDialog(page, 'Add Object')

    await outerSheet
      .getByRole('combobox')
      .filter({ hasText: /search for parent objects/i })
      .click()
    await page
      .getByRole('listbox')
      .getByRole('option', { name: /create new parent/i })
      .click()

    const nestedSheet = page.getByRole('dialog', { name: /add object/i }).last()
    await nestedSheet.getByLabel('Name').fill(`Inline Discard ${runId}`)

    // Discard the nested sheet — the handoff callbacks must NOT fire.
    await page.keyboard.press('Escape')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /discard changes/i })
      .click()
    await expect(nestedSheet).toBeHidden()

    // Outer parent picker selected-strip stays empty (no badge area rendered).
    await expect(outerSheet.locator('.bg-muted\\/20')).toHaveCount(0)
  })
})

/**
 * Regression: opening a name-only draft must not delete it.
 *
 * Reproduction: a draft saved via the "Save as draft" escape hatch (which
 * bypasses the worthiness gate so name-only content survives) used to be
 * wiped on re-open. The watcher in useFormDraftPersistence fired during the
 * load-reset, saw "dirty vs blank defaults but not worthy", and called
 * objectDraftsStore.delete(). The user noticed only after a page reload,
 * because the open sheet was hiding the (already-removed) row.
 *
 * Fix gates the auto-delete behind a field-level edit signal (info.name);
 * programmatic resets no longer trigger it.
 */
test.describe('21b - Draft survives reopen', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('iom-drafts:objects:')) toRemove.push(k)
      }
      toRemove.forEach((k) => localStorage.removeItem(k))
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('Name-only draft persists across open + reload', async ({ page }) => {
    const draftName = `Draft TC-Survive ${runId}`

    // Seed a name-only draft via the Save-as-draft escape hatch.
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await sheet.getByLabel('Name').fill(draftName)
    await page.keyboard.press('Escape')
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /save as draft/i })
      .click()
    await expect(sheet).toBeHidden()

    const draftRow = page.locator('tbody tr').filter({ hasText: draftName })
    await expect(draftRow).toHaveCount(1)

    // Open the draft via its row's Open button (this is where the bug fired).
    await draftRow.first().locator('[data-testid="draft-open-button"]').click()
    await expect(sheet).toBeVisible()

    // Close the sheet without editing — pick "Continue editing" then ESC +
    // Save as draft so we don't accidentally delete via the discard branch.
    // The point is: the load-reset must not have deleted the localStorage
    // entry between Open and now.
    const draftKeyExistsAfterOpen = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (
          k &&
          k.startsWith('iom-drafts:objects:') &&
          k !== 'iom-drafts:objects:index'
        ) {
          return true
        }
      }
      return false
    })
    expect(draftKeyExistsAfterOpen).toBe(true)

    // Now reload the page — the row must still be there.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await expect(
      page.locator('tbody tr').filter({ hasText: draftName })
    ).toHaveCount(1)
  })
})
