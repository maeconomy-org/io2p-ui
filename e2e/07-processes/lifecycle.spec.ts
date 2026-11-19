import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  createObjectWithId,
  createProcess,
  openProcess,
  processRow,
} from '../utils/process'
import { enterEditMode, saveSheet, sheet } from '../utils/sheet'
import { selectView } from '../utils/views'

/**
 * PR1 — the four verbs the list offers, end to end on one process.
 *
 * `list.read.spec.ts` has PR1a (rows render) and PR1b (the create sheet opens and cancels), which
 * between them never write a process. So the row actions this page mounts had no case at all, and
 * the menu SWAP is the part that matters: `process-columns.tsx` guards delete at `admin` rather
 * than `write`, and replaces the whole action list with a lone Restore once the row is deleted — so
 * a row that came back with the wrong menu looks identical to one that came back right.
 *
 * Soft delete, like everywhere else (D85): the row is hidden, not gone. The `deleted` filter is
 * what proves the difference, and it is also what makes Restore reachable.
 */

const stamp = () => `e2e-${Date.now()}`

async function toggleDeleted(page: Page): Promise<void> {
  await page.getByTestId('filter-menu').click()
  await page.getByTestId('filter-option-deleted').click()
  await page.keyboard.press('Escape')
}

test.describe('07 - processes / list lifecycle', () => {
  test('PR1: a process is created, renamed, deleted and restored from the list', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    // Disjoint strings, not a prefix and its extension: the "old name is gone" assertion filters
    // rows by text, and `-renamed` would still contain the original.
    const original = `${tag}-pr1-before`
    const renamed = `${tag}-pr1-after`

    await createObjectWithId(page, inputName)
    await createProcess(page, original, [inputName], inputName)

    // The filter menu renders only in table view (PR2), and the view is an account preference a
    // previous run may have left on the flow. Set it rather than assume it.
    await selectView(page, 'table')
    await expect(processRow(page, original)).toHaveCount(1)

    // Details then Edit. The row's own Edit action is PR1c's business.
    await openProcess(page, original)
    await enterEditMode(page)
    const panel = sheet(page)
    const nameField = panel.getByLabel(/name/i).first()
    await expect(nameField).toHaveValue(original)
    await nameField.fill(renamed)
    await saveSheet(page)

    // The new name in the LIST, and the old one gone from it — a rename that only updated the sheet
    // would satisfy the first assertion on a stale row.
    await page.reload()
    await expect(processRow(page, renamed)).toHaveCount(1)
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: original })
    ).toHaveCount(0)

    await processRow(page, renamed)
      .getByTestId('process-actions-dropdown')
      .click()
    await page.getByTestId('process-action-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: renamed })
    ).toHaveCount(0)

    // SOFT: still there behind the filter.
    await toggleDeleted(page)
    const deleted = processRow(page, renamed)
    await expect(deleted).toHaveCount(1)

    // And its menu is Restore ALONE. `rowActions` swaps the list wholesale for a deleted row, so an
    // Edit or a second Delete offered here would be a control the node refuses.
    await deleted.getByTestId('process-actions-dropdown').click()
    await expect(page.getByTestId('process-action-restore')).toBeVisible()
    await expect(page.getByTestId('process-action-edit')).toHaveCount(0)
    await expect(page.getByTestId('process-action-delete')).toHaveCount(0)

    await page.getByTestId('process-action-restore').click()

    // Back among the LIVE rows, which is the claim — with the deleted filter still on, a row that
    // never restored is still visible and indistinguishable from one that did.
    await toggleDeleted(page)
    await expect(processRow(page, renamed)).toHaveCount(1)
  })

  /**
   * PR1c — the row's Edit action opens a LIVE form.
   *
   * It used to open a dead one: the action sets `initialEditing`, so the Details inputs mount in the
   * same commit the fetch resolves, and the form's `reset` effect then dropped every registered ref.
   * Name rendered blank while the header showed the real name, and typing dirtied nothing — Save
   * never enabled, so the user's edit had nowhere to go. Switching tabs and back remounted the
   * fields and everything worked, which is what made it look cosmetic.
   *
   * PR1 covers the other path (Details → Edit) and always passed, so this case is the only one that
   * touches the row action. It asserts BOTH halves: the loaded value reaches the input, and a change
   * to it reaches the form.
   */
  test('PR1c: the row Edit action opens the form loaded and editable', async ({
    page,
  }) => {
    const tag = stamp()
    const inputName = `${tag}-in`
    const name = `${tag}-pr1c`

    await createObjectWithId(page, inputName)
    await createProcess(page, name, [inputName], inputName)
    await selectView(page, 'table')

    await processRow(page, name).getByTestId('process-actions-dropdown').click()
    await page.getByTestId('process-action-edit').click()
    await expect(sheet(page)).toBeVisible()

    await expect(page.locator('#entity-name')).toHaveValue(name)

    // No tab trip first — remounting the fields was the old workaround, and doing it here would
    // hide the very regression this case exists for.
    await page.locator('#entity-description').fill(`${name}-desc`)
    await expect(page.getByTestId('sheet-save')).toBeEnabled()

    // Reloaded, not read off the open sheet — the read view renders the FORM's value, so it would
    // show the description whether or not the save reached the node.
    await saveSheet(page)
    await page.reload()
    await openProcess(page, name)
    await expect(sheet(page)).toContainText(`${name}-desc`)
  })
})
