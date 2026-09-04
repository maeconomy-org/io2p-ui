import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

/**
 * `/objects/[uuid]` is the same list kit pointed at `?parent=`, so what is worth testing here is the
 * part that differs: the parent it is scoped to, and the two write paths that preset that parent.
 */

const runId = Date.now()
const PARENT = `e2e-${runId}-parent`
const CHILD = `e2e-${runId}-child`

/** Captured from the URL after the first navigation — the spec never learns an id any other way. */
let parentUrl = ''

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function createObject(page: Page, name: string, parentName?: string) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  if (parentName) {
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: parentName })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')
  }

  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

test.describe('04 - object children', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await createObject(page, PARENT)
    await createObject(page, CHILD, PARENT)

    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    parentUrl = page.url()

    await page.close()
  })

  test('CH1: the page lists the children of its object, with a count', async ({
    page,
  }) => {
    await page.goto(parentUrl)

    await expect(page.getByRole('heading', { name: PARENT })).toBeVisible()
    await expect(rowFor(page, CHILD)).toBeVisible()
    // The count is the SERVER's total, not the rendered row count — a page-2 child still counts.
    await expect(page.getByText(/\d+ children/)).toBeVisible()
  })

  test('CH2: Add Child opens the create sheet with this object preset as parent', async ({
    page,
  }) => {
    const name = `e2e-${Date.now()}-ch2`
    await page.goto(parentUrl)
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page.getByRole('button', { name: /add child/i }).click()
    const panel = sheet(page)
    await expect(panel).toBeVisible()

    // The preset must read as the parent's NAME. The page knows it, so a bare uuid here means
    // `defaultParentNames` was dropped somewhere between the page and the field.
    await expect(page.locator('[data-testid^="parent-badge-"]')).toContainText(
      PARENT
    )

    await panel.getByLabel(/name/i).first().fill(name)
    await saveSheet(page)
    await expect(panel).toBeHidden()

    await expect(rowFor(page, name)).toBeVisible()
  })

  test('CH3: Copy Objects Here opens the duplicate sheet with the parent locked', async ({
    page,
  }) => {
    await page.goto(parentUrl)
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page.getByTestId('split-button-trigger').click()
    await page.getByRole('menuitem', { name: /copy objects here/i }).click()

    const duplicate = page.getByTestId('duplicate-sheet')
    await expect(duplicate).toBeVisible()
    // "Here" IS the destination, so offering a target picker would let the user contradict the
    // button they pressed.
    await expect(page.getByTestId('duplicate-target-parent')).toHaveCount(0)
    await expect(page.getByTestId('duplicate-source-trigger')).toBeVisible()
  })

  test('CH5: row Duplicate opens the sheet from the children page too', async ({
    page,
  }) => {
    await page.goto(parentUrl)
    await expect(page.getByTestId('data-table')).toBeVisible()

    await rowFor(page, CHILD).getByTestId('object-actions-dropdown').click()
    await page.getByTestId('object-action-duplicate').click()

    await expect(page.getByTestId('duplicate-sheet')).toBeVisible()
    await expect(page.getByTestId('duplicate-source-trigger')).toContainText(
      /1 object selected/i
    )
  })

  test('CH4/CH5: row Duplicate on the list copies the subtree under a prefix', async ({
    page,
  }) => {
    // `prefixName` (lib/entity/duplicate.ts) trims the prefix and then joins with exactly ONE
    // space, so the separator is implicit and a trailing space here would not survive. Expect
    // "<prefix> <name>", never "<prefix><name>".
    const prefix = `c${Date.now()}-`
    const copyName = (name: string) => `${prefix} ${name}`
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await rowFor(page, PARENT).getByTestId('object-actions-dropdown').click()
    await page.getByTestId('object-action-duplicate').click()
    await expect(page.getByTestId('duplicate-sheet')).toBeVisible()

    // The switch only renders when the source is known to have children — `childCount` rides on the
    // list row, so a list fetched without `withChildCounts` hides the option entirely.
    const includeChildren = page.getByTestId('duplicate-include-children')
    await expect(includeChildren).toBeVisible()
    await includeChildren.click()

    await page.locator('#name-prefix').fill(prefix)
    await page.getByTestId('duplicate-confirm').click()
    await expect(page.getByTestId('duplicate-sheet')).toBeHidden()

    const copy = rowFor(page, copyName(PARENT))
    await expect(copy).toBeVisible()

    // Recursive: the copy is a new branch, so the child must hang off IT rather than off the
    // original — a subtree copied onto the source's own parent is the failure worth catching.
    await copy.dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await expect(rowFor(page, copyName(CHILD))).toBeVisible()
  })

  test('CH6: an unknown uuid says so instead of crashing', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/404|not found|io2p request failed/i)

    await page.goto('/objects/00000000-0000-4000-8000-000000000000')

    await expect(page.getByText(/parent object not found/i)).toBeVisible()
  })
})
