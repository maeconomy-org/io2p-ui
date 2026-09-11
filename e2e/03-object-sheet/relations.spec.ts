import { expect, test } from '../fixtures/app'
import { createObjectWithId, createProcess } from '../utils/process'
import {
  enterEditMode,
  openObjectSheet,
  saveSheet,
  switchTab,
} from '../utils/sheet'

/**
 * The Relations tab is read-only by design — a flow belongs to the PROCESS, so editing one here
 * would write to a different entity than the sheet is holding. What it must get right is the
 * grouping, the empty case, and the one way out.
 */

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: import('@playwright/test').Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

test.describe('03 - object sheet / relations', () => {
  test('R1/R2: an object that is both input and output appears in both groups', async ({
    page,
  }) => {
    const tag = stamp()
    const both = `${tag}-both`
    const other = `${tag}-other`
    const processName = `${tag}-proc`

    await createObjectWithId(page, both)
    await createObjectWithId(page, other)
    // `both` is consumed and produced by the same process, which is the case a single-group
    // implementation gets wrong.
    await createProcess(page, processName, [both, other], both)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, both))
    await switchTab(page, 'relations')

    const consumed = page.getByTestId('relations-consumed-by')
    const produced = page.getByTestId('relations-produced-by')
    await expect(consumed).toContainText(processName)
    await expect(produced).toContainText(processName)
    // The quantity travels with the relation; a group that lists the process without it says
    // nothing about how much.
    await expect(consumed.getByTestId('relation-quantity')).toHaveText('10')
    await expect(produced.getByTestId('relation-quantity')).toHaveText('4')
  })

  test('R3: an unreferenced object says so, rather than spinning', async ({
    page,
  }) => {
    const name = `${stamp()}-lonely`
    await createObjectWithId(page, name)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, name))
    await switchTab(page, 'relations')

    await expect(page.getByTestId('relations-empty')).toBeVisible()
    await expect(page.getByTestId('relations-view-all')).toHaveCount(0)
  })

  test('R5/R6: leaving for /processes runs through the unsaved guard', async ({
    page,
  }) => {
    const tag = stamp()
    const objectName = `${tag}-linked`
    const processName = `${tag}-proc`

    const objectId = await createObjectWithId(page, objectName)
    await createProcess(page, processName, [objectName], objectName)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, objectName))

    // Dirty on ANOTHER tab: the relations tab holds nothing editable, but leaving abandons whatever
    // the rest of the sheet has.
    await enterEditMode(page)
    await switchTab(page, 'details')
    await page
      .getByLabel(/description/i)
      .first()
      .fill('unsaved edit')

    await switchTab(page, 'relations')
    await page.getByTestId('relations-view-all').click()

    await expect(page.getByTestId('unsaved-dialog')).toBeVisible()
    await page.getByTestId('unsaved-cancel').click()
    await expect(page.getByTestId('entity-sheet')).toBeVisible()
    await expect(page).toHaveURL(/\/objects$/)

    await page.getByTestId('relations-view-all').click()
    await page.getByTestId('unsaved-discard').click()

    await expect(page).toHaveURL(new RegExp(`/processes\\?ref=${objectId}`))
    await expect(page.getByTestId('related-object-bar')).toBeVisible()
  })

  test('R7: soft-deleting the process removes the relation', async ({
    page,
  }) => {
    const tag = stamp()
    const objectName = `${tag}-orphaned`
    const processName = `${tag}-doomed`

    await createObjectWithId(page, objectName)
    await createProcess(page, processName, [objectName], objectName)

    await page.goto('/processes')
    const processRow = rowFor(page, processName)
    await processRow.getByTestId('process-actions-dropdown').click()
    await page.getByTestId('process-action-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', {
        name: /delete/i,
      })
      .click()
    await expect(rowFor(page, processName)).toHaveCount(0)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, objectName))
    await switchTab(page, 'relations')

    await expect(page.getByTestId('relations-empty')).toBeVisible()
  })
})

test.describe('03 - object sheet / parents', () => {
  test('PA1/PA2: the picker excludes self, and picking twice does not duplicate', async ({
    page,
  }) => {
    const tag = stamp()
    const parentName = `${tag}-parent`
    const childName = `${tag}-child`

    const parentId = await createObjectWithId(page, parentName)
    await createObjectWithId(page, childName)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, childName))
    await enterEditMode(page)
    await switchTab(page, 'details')

    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(childName)
    // `selfId` filters the object out of its own parent list — a self-parent is a cycle of one.
    await expect(page.locator('[data-testid^="parent-option-"]')).toHaveCount(0)

    await page.getByTestId('parent-search').fill(parentName)
    const option = page.getByTestId(`parent-option-${parentId}`)
    await expect(option).toBeVisible()
    await option.click()
    await expect(page.getByTestId(`parent-badge-${parentId}`)).toHaveCount(1)

    // The list is a toggle, so a second select removes rather than duplicating.
    await option.click()
    await expect(page.getByTestId(`parent-badge-${parentId}`)).toHaveCount(0)
    await option.click()
    await expect(page.getByTestId(`parent-badge-${parentId}`)).toHaveCount(1)
  })

  test('PA4: gaining a parent says where the object went, and the badge goes there', async ({
    page,
  }) => {
    const tag = stamp()
    const parentName = `${tag}-destination`
    const childName = `${tag}-moving`

    const parentId = await createObjectWithId(page, parentName)
    await createObjectWithId(page, childName)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, childName))
    await enterEditMode(page)
    await switchTab(page, 'details')
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    await page.getByTestId(`parent-option-${parentId}`).click()
    await page.keyboard.press('Escape')
    await saveSheet(page)

    // The row it was on has just disappeared — `/objects` lists roots — so this toast is the only
    // thing that says where it went.
    // Sonner renders an `<li>` inside `ol[data-sonner-toaster]`; it carries no `status` role.
    const toast = page
      .locator('[data-sonner-toaster] li')
      .filter({ hasText: parentName })
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Moved under')

    await toast.getByRole('button', { name: /open/i }).click()
    await expect(page).toHaveURL(new RegExp(`/objects/${parentId}`))
    await expect(rowFor(page, childName)).toBeVisible()
  })

  test('PA3: a parent badge reads as a name, never a bare uuid', async ({
    page,
  }) => {
    const tag = stamp()
    const parentName = `${tag}-named-parent`
    const childName = `${tag}-named-child`

    const parentId = await createObjectWithId(page, parentName)
    await createObjectWithId(page, childName)

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, childName))
    await enterEditMode(page)
    await switchTab(page, 'details')
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    await page.getByTestId(`parent-option-${parentId}`).click()
    // The picker is a popover and it stays open after a pick — it covers the footer, so Save is
    // unreachable until it is dismissed.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId(`parent-badge-${parentId}`)).toBeVisible()
    // Saving an EXISTING object returns the sheet to read mode rather than closing it.
    await saveSheet(page)

    // `/objects` lists ROOTS (`parent=`), so a child that just gained a parent is no longer there —
    // it is reopened from the parent's own page, which is where it now lives.
    await page.goto(`/objects/${parentId}`)
    await openObjectSheet(page, rowFor(page, childName))
    await switchTab(page, 'details')

    const badge = page.getByTestId(`parent-badge-${parentId}`)
    await expect(badge).toContainText(parentName)
    await expect(badge).not.toContainText(parentId)

    // The name is a LINK: the parent's page is where this object now lives.
    await badge.getByTestId(`parent-link-${parentId}`).click()
    await expect(page).toHaveURL(new RegExp(`/objects/${parentId}`))
  })
})
