import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'
import { rowActions, tour } from '../utils/selectors'

/**
 * What a share does at the END of its life, which is where it stops behaving like everything else.
 *
 * There is no restore endpoint for a share. A deleted bundle is DUPLICATED back into existence —
 * the normal create path, which re-validates that every resource still exists and is still
 * shareable — rather than resurrected against a world that moved on. So the row's whole menu
 * changes shape, and the primary button changes meaning with it.
 *
 * And the bulk delete is deliberately not `Promise.all`: each delete revokes every grant its bundle
 * owns, so a partial failure has to stop rather than leave an unknown subset revoked.
 */

// Read at runtime rather than imported: the repo is ESM, so a JSON import would need an attribute.
const here = dirname(fileURLToPath(import.meta.url))
const en = JSON.parse(
  readFileSync(resolve(here, '../../src/messages/en.json'), 'utf8')
) as { access: { permission: Record<string, string> } }
const PERMISSION_LABELS = Object.values(en.access.permission)

const second = secondCredentials()
const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function showDeleted(page: Page): Promise<void> {
  await page.getByTestId('filter-menu').click()
  await page.getByTestId('filter-option-deleted').click()
  await page.keyboard.press('Escape')
}

/**
 * A saved bundle needs a resource AND a member — the node refuses anything less, which is what S4
 * pins from the other side.
 */
async function createShare(page: Page, name: string, resourceName: string) {
  await page.goto('/shares')
  await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
  await tour(page, 'sharesCreate').click()
  await page.getByTestId('share-name').fill(name)

  await page.getByTestId('resource-picker').click()
  await page.getByTestId('resource-search').fill(resourceName)
  await page
    .locator('[data-testid^="resource-option-"]')
    .filter({ hasText: resourceName })
    .first()
    .click()

  await page.getByTestId('member-picker').click()
  await page.getByTestId('member-search').fill(second!.email)
  const member = page.locator('[data-testid^="member-option-"]').first()
  await expect(member).toBeVisible()
  await member.click()

  await expect(page.getByTestId('share-save')).toBeEnabled()
  await page.getByTestId('share-save').click()
  await expect(rowFor(page, name)).toBeVisible()
}

test.describe('11 - shares / lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a bundle needs a member to save'
  )

  test('S14: a permission badge is readable without its colour', async ({
    page,
  }) => {
    const tag = stamp()
    const shareName = `${tag}-s14`
    await createObjectWithId(page, `${tag}-res`)
    await createShare(page, shareName, `${tag}-res`)

    // A fresh load rather than clicking straight after the save: the editor sheet is still
    // unmounting, and a click landing on its overlay does nothing at all.
    await page.goto('/shares')
    await expect(page.getByTestId('data-table').last()).toBeVisible()

    // The details BUTTON, not the row. A bare row click opens nothing here — which is worth
    // knowing, because S5 asserts only that `share-name` is absent afterwards, and that is
    // trivially true when no sheet opened at all.
    await rowFor(page, shareName).getByTestId('share-details-button').click()
    const detail = page.getByRole('dialog')
    await expect(detail).toBeVisible()
    // The members live behind their own tab; the overview does not list them. By TESTID, because
    // that trigger has no text — an icon and a bare count, so its accessible name is the number.
    await detail.getByTestId('share-detail-tab-members').click()

    // EVERY badge, by testid, not the first span whose text happens to match. "Share" is itself a
    // permission label AND a word all over the shares page, so a bare text match could land on
    // chrome and pass with every badge stripped. And the contract `badge.tsx` states is universal —
    // "Colour is never alone: every tone keeps its text label" — so asserting one labelled badge
    // exists only coincides with it while the fixture has a single member.
    const badges = detail.getByTestId('permission-badge')
    await expect(badges.first()).toBeVisible()
    const labels = await badges.allTextContents()
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(PERMISSION_LABELS).toContain(label.trim())
    }
  })

  test('S7: a deleted bundle offers Duplicate, and no restore', async ({
    page,
  }) => {
    const tag = stamp()
    const shareName = `${tag}-s7`
    await createObjectWithId(page, `${tag}-res`)
    await createShare(page, shareName, `${tag}-res`)

    const row = rowFor(page, shareName)
    const actions = rowActions(page, 'share', row)
    await actions.menu.click()
    await actions.action('delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()

    await showDeleted(page)
    const deleted = rowFor(page, shareName)
    await expect(deleted).toBeVisible()

    // The menu NARROWS to one item. Asserting Duplicate is present would pass on a menu that still
    // offered Delete beside it, which is the shape that regresses.
    const deletedActions = rowActions(page, 'share', deleted)
    await deletedActions.menu.click()
    await expect(deletedActions.action('duplicate')).toBeVisible()
    await expect(deletedActions.action('delete')).toHaveCount(0)
    await expect(deletedActions.action('edit')).toHaveCount(0)
    // ⚠ A GUARD FOR THE FUTURE, not a check on the present: `share-action-restore` exists nowhere
    // in the app, so today this cannot fail. It is kept because `rowActions` mints
    // `${prefix}-action-${key}`, so a restore action added later would land on exactly this id and
    // this line would catch it. The two above it are doing real work — `delete` and `edit` DO exist
    // and are genuinely absent here.
    await expect(page.getByTestId('share-action-restore')).toHaveCount(0)

    await page.keyboard.press('Escape')
    // The primary button changes MEANING, not just availability: on a deleted row it duplicates
    // rather than opening the detail sheet.
    await expect(deleted.getByTestId('share-details-button')).toContainText(
      /duplicate/i
    )
  })

  test('S8: bulk delete runs sequentially and stops on the first failure', async ({
    page,
    consoleGuard,
  }) => {
    // The refusal below is the POINT of the case, so it is declared rather than tolerated — an
    // undeclared 500 would fail this at teardown, and a blanket ignore would hide a real one.
    consoleGuard.expectError(/500 \(Internal Server Error\)/)

    const tag = stamp()
    await createObjectWithId(page, `${tag}-res`)
    await createShare(page, `${tag}-s8-a`, `${tag}-res`)
    await createShare(page, `${tag}-s8-b`, `${tag}-res`)

    const deletes: string[] = []
    await page.route('**/api/v1/shares/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.continue()
      deletes.push(route.request().url())
      // Every delete refused. Under `Promise.all` both would be in flight before either failed.
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ title: 'refused' }),
      })
    })

    await page.goto('/shares')
    await expect(page.getByTestId('data-table').last()).toBeVisible()
    for (const suffix of ['a', 'b']) {
      await rowFor(page, `${tag}-s8-${suffix}`).getByRole('checkbox').check()
    }
    await expect(page.getByTestId('bulk-count')).toContainText('2')

    await page.getByTestId('bulk-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()

    // ONE request, not two. That single number is the whole case: it proves the loop awaited each
    // delete AND that the throw left the rest unattempted, which is what stops a partial failure
    // revoking an unknown subset of grants.
    await expect
      .poll(() => deletes.length, { message: 'DELETE /shares calls' })
      .toBe(1)
    // The app KNEW it stopped. `deletes.length === 1` alone is also what "fired one and then fell
    // over" looks like — a re-render dropping the pending list, the dialog unmounting the handler.
    // A loop that stopped deliberately reports; one that fell over does not.
    await expect(page.getByText(/could not delete/i).first()).toBeVisible()
  })
})
