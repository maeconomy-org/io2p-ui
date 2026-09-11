import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openDialog } from '../utils/sheet'
import { tour, type EntityPrefix } from '../utils/selectors'

/**
 * Templates, formulas and constants are three pages of one Library, so the chrome they share is
 * asserted once over all three rather than three times in three files.
 */

const stamp = () => `e2e-${Date.now()}`

interface LibraryPage {
  path: string
  prefix: EntityPrefix
  create: 'templatesCreate' | 'formulasCreate' | 'constantsCreate'
}

const PAGES: LibraryPage[] = [
  { path: '/templates', prefix: 'template', create: 'templatesCreate' },
  { path: '/formulas', prefix: 'formula', create: 'formulasCreate' },
  { path: '/constants', prefix: 'constant', create: 'constantsCreate' },
]

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

test.describe('08 - library', () => {
  for (const library of PAGES) {
    test(`LB1: ${library.path} offers filters, bulk select, the deleted toggle and share`, async ({
      page,
      api,
    }) => {
      await page.goto(library.path)
      await expect(page.getByTestId('data-table')).toBeVisible()
      await expect(tour(page, library.create)).toBeVisible()

      await page.getByTestId('filter-menu').click()
      await page.getByTestId('filter-option-deleted').click()
      await page.keyboard.press('Escape')
      // Asserted on the REQUEST: whether this account has any deleted rows is seed data.
      await expect.poll(() => api.count(/deleted=include/)).toBeGreaterThan(0)

      await page.getByTestId('filter-menu').click()
      await page.getByTestId('filter-clear').click()
      await page.keyboard.press('Escape')

      const row = page.getByTestId('data-table-row').first()
      await expect(row).toBeVisible()
      await row.getByRole('checkbox').check()
      await expect(page.getByTestId('bulk-bar')).toBeVisible()
      await expect(page.getByTestId('bulk-count')).toContainText('1')
      await expect(page.getByTestId('bulk-share')).toBeVisible()
      await page.getByTestId('bulk-clear').click()
      await expect(page.getByTestId('bulk-bar')).toBeHidden()

      await row.getByTestId(`${library.prefix}-actions-dropdown`).click()
      await expect(
        page.getByTestId(`${library.prefix}-action-share`)
      ).toBeVisible()
    })
  }
})

test.describe('09 - formulas / lifecycle', () => {
  test('FM4: duplicating a formula leaves the original and its bindings alone', async ({
    page,
  }) => {
    const tag = stamp()
    // Distinct names, not a `-copy` SUFFIX: `hasText` is a substring match, so a suffixed copy is
    // also a match for the original and `.first()` silently picks whichever renders first.
    const name = `${tag}-original`
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'formulasCreate').click()
    const created = await openDialog(page)
    await created.getByLabel(/name/i).first().fill(name)
    await created.getByLabel(/expression/i).fill('a * 2')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('formula-actions-dropdown').click()
    await page.getByTestId('formula-action-duplicate').click()

    const copyName = `${tag}-duplicate`
    const copy = await openDialog(page)
    await copy.getByLabel(/name/i).first().fill(copyName)
    await copy.getByLabel(/expression/i).fill('a * 3')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()

    // A formula is IMMUTABLE: an object that pinned the original must keep evaluating to the same
    // number, so a duplicate is a new record rather than an edit of the old one.
    await expect(rowFor(page, copyName)).toHaveCount(1)
    await expect(rowFor(page, name)).toContainText('a * 2')
  })

  test('FM6: a formula soft-deletes and restores', async ({ page }) => {
    const name = `${stamp()}-fm6`
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'formulasCreate').click()
    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(name)
    await dialog.getByLabel(/expression/i).fill('x + 1')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('formula-actions-dropdown').click()
    await page.getByTestId('formula-action-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(rowFor(page, name)).toHaveCount(0)

    // SOFT: the row is hidden, not gone — a formula an object pinned can never be removed.
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('formula-actions-dropdown').click()
    await page.getByTestId('formula-action-restore').click()
    await expect(rowFor(page, name)).toContainText(name)
  })
})

test.describe('10 - constants / lifecycle', () => {
  test('CO4: a constant soft-deletes and restores', async ({ page }) => {
    const name = `${stamp()}-co4`
    await page.goto('/constants')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'constantsCreate').click()
    await page.locator('#constant-name').fill(name)
    await page.locator('#constant-data').fill('7')
    await page
      .getByRole('button', { name: /create constant/i })
      .last()
      .click()
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(rowFor(page, name)).toHaveCount(0)

    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-restore').click()
    await expect(rowFor(page, name)).toContainText(name)
  })

  test('CO3: appending a version leaves the earlier versions readable', async ({
    page,
  }) => {
    const name = `${stamp()}-co3`
    await page.goto('/constants')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'constantsCreate').click()
    await page.locator('#constant-name').fill(name)
    await page.locator('#constant-data').fill('0.42')
    await page
      .getByRole('button', { name: /create constant/i })
      .last()
      .click()
    await expect(rowFor(page, name)).toHaveCount(1)

    await rowFor(page, name).getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-edit').click()
    await page.locator('#constant-data').fill('0.51')
    await page
      .getByRole('button', { name: /add version/i })
      .last()
      .click()

    await rowFor(page, name).getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-edit').click()

    // APPEND-ONLY. A calc pinned version 1 at bind time, so version 1 has to stay readable —
    // `03-object-sheet/formulas.spec.ts` F13 asserts the object side of the same rule.
    const history = page.getByTestId('constant-versions')
    await expect(history).toContainText('0.42')
    await expect(history).toContainText('0.51')
  })
})
