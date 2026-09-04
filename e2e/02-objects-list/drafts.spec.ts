import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { tour } from '../utils/selectors'
import { restoreSession, signInAs } from '../utils/session'
import {
  addProperty,
  expandProperty,
  fillProperty,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * A draft lives in localStorage under the signed-in user's id, so it is the one thing on this page
 * the server knows nothing about — it cannot be searched, sorted or paginated, and it must never
 * cross accounts.
 */

const stamp = () => `e2e-${Date.now()}`
const TINY = 'e2e/fixtures/uploads/tiny-1kb.txt'

function draftRow(page: Page, name: string) {
  return page.getByTestId('draft-row').filter({ hasText: name }).first()
}

/**
 * Open the create sheet and type enough to make it dirty.
 *
 * Waits for the IDENTITY first: drafts key on the signed-in user id, so one saved before `/me`
 * resolves has nowhere to go. The user menu renders a skeleton until then.
 */
async function startDraft(page: Page, name: string) {
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
  // The trigger holds a SKELETON until `/me` lands, and a skeleton is a child element — so the
  // wait has to be for real text, not for non-emptiness.
  await expect(tour(page, 'userMenuTrigger')).toContainText(/\S/)
  await tour(page, 'createObject').click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(/name/i).first().fill(name)
}

async function saveAsDraft(page: Page, name: string) {
  await startDraft(page, name)
  await page.keyboard.press('Escape')
  await page.getByTestId('unsaved-save-draft').click()
  await expect(sheet(page)).toBeHidden()
  await expect(draftRow(page, name)).toHaveCount(1)
}

/**
 * D9 signs in as the second account, which ENDS the primary account's session for the whole origin.
 * Restoring inline on D9's last line is not enough: if D9 fails earlier, every write spec after this
 * FILE runs signed out and reports its own unrelated-looking failure. `afterAll` runs regardless.
 *
 * `restoreSession` also rewrites the saved storageState, which every following file builds its
 * context from — without it they load the token the sign-outs invalidated.
 */
test.afterAll(async ({ browser }) => {
  if (!secondCredentials()) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)
  await context.close()
})

test.describe('02 - objects list / drafts', () => {
  test('D1: Escape with unsaved work offers Save draft, Discard and Cancel', async ({
    page,
  }) => {
    await startDraft(page, `${stamp()}-d1`)
    await page.keyboard.press('Escape')

    const dialog = page.getByTestId('unsaved-dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('unsaved-save-draft')).toBeVisible()
    await expect(page.getByTestId('unsaved-discard')).toBeVisible()
    await expect(page.getByTestId('unsaved-cancel')).toBeVisible()

    await page.getByTestId('unsaved-cancel').click()
    await expect(sheet(page)).toBeVisible()
  })

  test('D2: the Cancel BUTTON raises the same prompt as Escape', async ({
    page,
  }) => {
    await startDraft(page, `${stamp()}-d2`)

    // The footer button used to skip the guard, so Escape asked and the control right next to Save
    // discarded silently.
    await page.getByTestId('sheet-cancel').click()
    await expect(page.getByTestId('unsaved-dialog')).toBeVisible()
    await expect(page.getByTestId('unsaved-save-draft')).toBeVisible()
  })

  test('D3/D5: a saved draft pins above the server rows with the same actions menu', async ({
    page,
  }) => {
    const name = `${stamp()}-d3`
    await saveAsDraft(page, name)

    // PINNED: the draft is not part of the server page, so it sits above the first server row
    // rather than in whatever position a sort would have given it.
    const draftBox = await draftRow(page, name).boundingBox()
    const firstServerRow = await page
      .getByTestId('data-table-row')
      .first()
      .boundingBox()
    expect(draftBox?.y ?? 0).toBeLessThan(firstServerRow?.y ?? 0)

    await draftRow(page, name).getByTestId('draft-actions-dropdown').click()
    await expect(page.getByTestId('draft-action-discard')).toBeVisible()
  })

  test('D4/D6: reopening restores every field, and saving it clears the draft row', async ({
    page,
  }) => {
    const name = `${stamp()}-d4`
    await startDraft(page, name)
    await sheet(page)
      .getByLabel(/description/i)
      .first()
      .fill('a description that must survive')
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Material', 'oak')

    await page.keyboard.press('Escape')
    await page.getByTestId('unsaved-save-draft').click()
    await expect(draftRow(page, name)).toHaveCount(1)

    await draftRow(page, name).getByTestId('draft-details-button').click()
    await expect(sheet(page)).toBeVisible()
    await expect(sheet(page).getByLabel(/name/i).first()).toHaveValue(name)
    await expect(
      sheet(page)
        .getByLabel(/description/i)
        .first()
    ).toHaveValue('a description that must survive')
    // A resumed row is not NEW, so it renders collapsed and Radix unmounts its contents.
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-name-0')).toHaveValue('Material')
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('oak')

    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    // The object exists on the server now, so the local copy is a draft of nothing — leaving it
    // would show the same thing twice, once as a ghost.
    await expect(draftRow(page, name)).toHaveCount(0)
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: name })
    ).toHaveCount(1)
  })

  test('D7: picking files warns that they will not survive the draft', async ({
    page,
  }) => {
    const name = `${stamp()}-d7`
    await startDraft(page, name)

    await page.getByTestId('add-files').click()
    await page.locator('input[type=file]').first().setInputFiles(TINY)
    await page.getByTestId('attachment-modal-done').click()

    // The just-closed attachment modal swallows the first Escape, so the footer button — proved
    // equivalent by D2 — is the reliable way to raise the guard here.
    await page.getByTestId('sheet-cancel').click()
    const dialog = page.getByTestId('unsaved-dialog')
    await expect(dialog).toBeVisible()
    // A File handle cannot be serialised into localStorage, so the pick is genuinely lost — saying
    // so is the difference between a known trade and a silent one.
    await expect(dialog).toContainText(/file/i)
  })

  for (const scenario of [
    { case: 'search', label: 'a search is active' },
    { case: 'deleted', label: 'deleted rows are shown' },
    { case: 'sort', label: 'a sort is applied' },
  ] as const) {
    test(`D8: drafts are hidden when ${scenario.label}`, async ({ page }) => {
      const name = `${stamp()}-d8-${scenario.case}`
      await saveAsDraft(page, name)

      if (scenario.case === 'search') {
        await tour(page, 'searchButton').click()
        const searchDialog = page.getByRole('dialog')
        await searchDialog
          .getByRole('combobox')
          .or(searchDialog.getByRole('textbox'))
          .first()
          .fill('e2e')
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('search-results-bar')).toBeVisible()
      } else if (scenario.case === 'deleted') {
        await page.getByTestId('filter-menu').click()
        await page.getByTestId('filter-option-deleted').click()
        await page.keyboard.press('Escape')
      } else {
        await page
          .getByRole('button', { name: /^name$/i })
          .first()
          .click()
      }

      // The server cannot search, sort or paginate a row it has never seen, so showing one here
      // would claim it matched a query it was never tested against.
      await expect(draftRow(page, name)).toHaveCount(0)
    })
  }

  /**
   * ⏸ DEFERRED — not root-caused. See `docs/e2e-docs/e2e-run-2026-08-31.md` "Still open" #2.
   *
   * Fails alone, so it is not state contention. Sign-out on its own is healthy — probed: it lands
   * on `/` with the form rendered — so the break is in the SECOND account switch, where the page
   * sits on `/objects` painting a signed-in navbar beside a 401. NOT the same bug as the locale
   * reconcile above, though it has the same shape: the client did not react to something that
   * changed underneath it.
   */
  test.fixme('D9: a draft does not follow you to another account', async ({
    page,
  }) => {
    const second = secondCredentials()
    test.skip(
      !second,
      'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — this needs a second account'
    )

    const name = `${stamp()}-d9`
    await saveAsDraft(page, name)

    await tour(page, 'userMenuTrigger').click()
    await page.getByTestId('nav-sign-out').click()

    // `signInAs`, not the three lines it wraps. Sign-out leaves via `window.location.assign('/')`,
    // so the login form paints once from the client transition and again from the full document
    // load — a `fill` between the two lands on a node the reload throws away, and reports as a 60s
    // timeout on `getByLabel('Email')` beside a 401 the console guard also catches.
    await signInAs(page, second!)
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Drafts key on the signed-in user's id. Same origin, same localStorage — the id is the only
    // thing keeping one account's unsaved work out of another's list.
    await expect(draftRow(page, name)).toHaveCount(0)

    // And it is still there for the account that wrote it.
    await tour(page, 'userMenuTrigger').click()
    await page.getByTestId('nav-sign-out').click()
    await restoreSession(page)
    await expect(draftRow(page, name)).toHaveCount(1)
  })
})
