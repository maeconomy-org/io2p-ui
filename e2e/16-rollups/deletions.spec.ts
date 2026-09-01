import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  removeProperty,
  saveSheet,
  sheet,
} from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * A soft delete removes a contribution, and a restore brings it back.
 *
 * This is what the delete dialog promises in its own copy — "no longer count toward rollups" — and
 * nothing checked it. Every write here is soft: D85 makes deletion reversible at every level, so a
 * case that hard-deleted anything would be testing a path the product does not have.
 *
 * The fixture is deliberately ONE contributor under a parent that authors nothing itself, so every
 * assertion is a card PRESENT or ABSENT. Comparing numbers across a write is a race — a read
 * straight after one may return the old totals still marked `stale: false` — and a card appearing
 * or going is the only transition the contract actually promises.
 */

const runId = Date.now()
const KEY = `del${runId}`
const PARENT = `e2e-${runId}-del-parent`
const CHILD = `e2e-${runId}-del-child`

const createdRules: string[] = []

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

async function createRule(page: Page, key: string): Promise<void> {
  createdRules.push(key)
  await page.goto('/rollup-rules')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'rollupRulesCreate').click()
  await page.getByTestId('rollup-rule-property-key').fill(key)
  await page.getByTestId('rollup-rule-add-key').click()
  await page.getByTestId('rollup-rule-submit').click()
  await expect(
    page.getByTestId('data-table-row').filter({ hasText: key })
  ).toHaveCount(1)
}

async function createObject(
  page: Page,
  name: string,
  value?: string,
  parentName?: string
): Promise<void> {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  if (value) {
    await addProperty(page, 0)
    await fillProperty(page, 0, KEY, value)
  }

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

/** Open the child through its PARENT: `/objects` asks `parent=''`, so a child is not in that list. */
async function openChild(page: Page): Promise<void> {
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await rowFor(page, PARENT).dblclick()
  await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
  await openObjectSheet(page, rowFor(page, CHILD))
}

/**
 * Reopen the parent until the card is there, or is gone.
 *
 * A plain loop, not `toPass`: the retry wrapper swallows the real error on every attempt, and what
 * is being waited on is a background worker rather than a flaky assertion. Editing a descendant
 * does not refresh an ancestor already on screen, so each attempt REOPENS rather than waiting in
 * place. Worst case on defaults is ~90s — a 30s cooldown, then a reaper scanning every 30s.
 */
async function pollParentCard(page: Page, want: boolean): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))
    await page.waitForTimeout(4_000)
    const present = (await page.getByTestId('rollup-card').count()) > 0
    if (present === want) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(25_000)
  }
  throw new Error(
    `the parent never reached: rollup card ${want ? 'present' : 'absent'}`
  )
}

test.describe('16 - rollups / deletions', () => {
  test.describe.configure({ mode: 'serial' })

  /**
   * The rule is created FIRST. A rule added after the objects renders nothing, forever — the worker
   * recomputes on a write to the subtree, never on a rule — so a fixture in the other order fails
   * for a reason that has nothing to do with deleting.
   */
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(300_000)
    const page = await browser.newPage()

    await createRule(page, KEY)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    // The parent authors NOTHING under this key: it must be the child that puts the card there, or
    // an absent card later would prove nothing about the child.
    await createObject(page, PARENT)
    await createObject(page, CHILD, '10 kg', PARENT)

    await pollParentCard(page, true)
    await page.close()
  })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    for (const key of createdRules) {
      const row = page.getByTestId('data-table-row').filter({ hasText: key })
      await expect(row).toHaveCount(1, { timeout: 15_000 })
      const actions = rowActions(page, 'rollup-rule', row)
      await actions.menu.click()
      await actions.action('delete').click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^delete$/i })
        .click()
      await expect(row).toHaveCount(0, { timeout: 15_000 })
    }
    await page.close()
  })

  test('RU17: soft-deleting the property drops it from the total', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    await openChild(page)
    await enterEditMode(page)
    await removeProperty(page, 0)
    await expect(page.getByTestId('property-deleted-0')).toBeVisible()
    await saveSheet(page, { expectClose: false })

    // The child was the only numeric contributor, so with its value gone the parent has nothing
    // below it and the card must go too — a deleted value that still counted would be invisible.
    await pollParentCard(page, false)
  })

  test('RU18: soft-deleting the child object removes its contribution', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(420_000)

    // Put the property back first, so this case starts from a card that exists and the deletion is
    // the only thing that could have removed it.
    await openChild(page)
    await enterEditMode(page)
    await expect(page.getByTestId('property-deleted-0')).toBeVisible()
    await page.getByTestId('property-deleted-0-restore').click()
    await expect(page.getByTestId('property-row-0')).toBeVisible()
    await saveSheet(page, { expectClose: false })
    await pollParentCard(page, true)

    await openChild(page)
    await page.getByTestId('sheet-delete').click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(CHILD)
    await dialog.getByRole('button', { name: /delete/i }).click()
    await expect(page.getByTestId('sheet-restore')).toBeVisible()

    await pollParentCard(page, false)
  })

  test('RU19: restoring the child brings the contribution back', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)

    // A deleted child is out of the default list, so the deleted filter is how it is reached — the
    // same route a user takes.
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')

    await openObjectSheet(page, rowFor(page, CHILD))
    await page.getByTestId('sheet-restore').click()
    await expect(page.getByTestId('sheet-edit')).toBeVisible()

    await pollParentCard(page, true)
  })
})
