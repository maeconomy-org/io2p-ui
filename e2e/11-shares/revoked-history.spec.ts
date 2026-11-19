import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '../fixtures/app'
import { AUTH_STATE, secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'
import { rowActions } from '../utils/selectors'
import { gotoList } from '../utils/sheet'

// Read at runtime rather than imported: the repo is ESM, so a JSON import would need an attribute.
// Same source as S14 — the labels come from the catalogue the app renders, never from a literal, so
// the case is not a false red the moment the account is left in Dutch.
const here = dirname(fileURLToPath(import.meta.url))
const en = JSON.parse(
  readFileSync(resolve(here, '../../src/messages/en.json'), 'utf8')
) as { access: { permission: Record<string, string> } }
const PERMISSION_LABELS = Object.values(en.access.permission)

/**
 * S9 — who USED to have access, and the rule that decides when they stop being listed.
 *
 * `73ec00d` added the history, guarded by `if (live.has(key)) continue`. This case drives both
 * DIRECTIONS of that guard on ONE subject through ONE source: revoke and they appear in the history;
 * restore and they leave it, because a live grant now covers the same key. A history that kept
 * listing a person sitting in the members list above is the failure the commit message names, and a
 * count-only assertion would miss it.
 *
 * WHAT THIS DOES NOT COVER: the `source` half of the key. `live` is keyed by
 * `${keyOf(subject)}::${shareId ?? 'direct'}`, and the reason source is in there is that a live
 * Share-sourced grant must NOT hide a revoked direct one — "and only that one". Everything below
 * would pass identically against a projection keyed by subject alone, because one subject with one
 * source cannot tell them apart. Covering it needs the same person holding a live Share-sourced
 * grant beside a revoked direct one, which is fixture work this case does not do.
 *
 * No session switch: account 2 is only ever a SUBJECT here, never signed in, so this file owes no
 * `restoreSession`.
 */

const second = secondCredentials()

/** The object this run made, so the teardown finds it after a failure too. */
let createdObject: string | null = null

/**
 * DELETE THE OBJECT, and this is not tidiness — it is the state this case would otherwise hand to
 * the next spec.
 *
 * S9 ends with the grant RESTORED, which is the point of the case: account 2 is a live member of
 * this object when the test finishes. `share-sheet.spec.ts` SS2 opens the share sheet on
 * `data-table-row.first()` — the NEWEST object — and the people picker excludes anyone already in
 * the draft (`candidates = users.filter((u) => !draft[u.id])`). So the newest object having a
 * member makes the picker return nothing, and SS2 fails 15s later on an option that will never
 * appear.
 *
 * Measured: SS2 passes when its file runs alone and fails when this file runs before it.
 */
test.afterAll(async ({ browser }, testInfo) => {
  if (!createdObject) return
  testInfo.setTimeout(120_000)
  // `browser`, not `page` — `page` and `context` are per-test fixtures and Playwright refuses them
  // in `afterAll` outright, which fails the hook and reports it on the test that had already passed.
  const context = await browser.newContext({ storageState: AUTH_STATE })
  const page = await context.newPage()
  await gotoList(page, '/objects')
  const row = page
    .getByTestId('data-table-row')
    .filter({ hasText: createdObject })
  try {
    await expect(row.first()).toBeVisible({ timeout: 15_000 })
  } catch {
    await context.close()
    return
  }
  const actions = rowActions(page, 'object', row.first())
  await actions.menu.click()
  await actions.action('delete').click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /delete/i })
    .click()
  await expect(row).toHaveCount(0, { timeout: 15_000 })
  await context.close()
})

test.describe('11 - shares / revoked history', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a revoked grant needs a grantee'
  )

  test('S9: a revoke joins the history, and a restore leaves it', async ({
    page,
  }) => {
    const objectName = `e2e-${Date.now()}-s9`
    createdObject = objectName
    await createObjectWithId(page, objectName)

    await page.goto('/objects')
    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: objectName })
      .first()
    await expect(row).toBeVisible()

    const openShare = async () => {
      await row.getByTestId('object-actions-dropdown').click()
      await page.getByTestId('object-action-share').click()
      // The people-picker popover is ALSO `role="dialog"`, so the sheet is named rather than taken
      // as the only one.
      const panel = page.getByRole('dialog', { name: /share/i })
      await expect(panel).toBeVisible()
      return panel
    }

    let panel = await openShare()

    // The picker searches the SERVER (`shouldFilter={false}`), so an empty box offers nobody.
    await page.getByTestId('share-add-people').click()
    await page.getByTestId('people-search').fill(second!.email)
    const option = page.getByRole('option').first()
    await expect(option).toBeVisible({ timeout: 15_000 })
    await option.click()

    // The draft key is minted by the sheet, so it is read off the DOM rather than guessed — and it
    // is the same key the revoked rows are addressed by (`keyOf(grant.subject)`).
    // `^="share-member-"` also matches `share-member-remove-<id>`, and `.first()` only returns the
    // row because the button is nested inside it. A DOM reshuffle would hand back `remove-<id>` as
    // the subject id and every locator below would silently address nothing — so the id is checked
    // for the prefix that would mean exactly that.
    const member = panel.locator('[data-testid^="share-member-"]').first()
    const subjectId = (await member.getAttribute('data-testid'))!.replace(
      'share-member-',
      ''
    )
    expect(subjectId, 'read the remove button, not the member row').not.toMatch(
      /^remove-/
    )

    await page.getByTestId('share-sheet-save').click()
    await expect(panel).toBeHidden()

    // Nobody has been revoked yet, so the section must not exist at all — a history that renders
    // empty would make every assertion below pass on the wrong grant.
    panel = await openShare()
    await expect(page.getByTestId('revoked-toggle')).toHaveCount(0)

    await page.getByTestId(`share-member-remove-${subjectId}`).click()
    await page.getByTestId('share-sheet-save').click()
    await expect(panel).toBeHidden()

    // REOPENED, so the history is read back from the node rather than from the draft that was just
    // on screen — the sheet drops the row locally the moment you click.
    panel = await openShare()
    const toggle = page.getByTestId('revoked-toggle')
    await expect(toggle).toBeVisible()
    await expect(page.getByTestId('revoked-count')).toHaveText('1')

    // Collapsed by default: the rows do not exist until it is opened.
    await expect(page.getByTestId(`revoked-row-${subjectId}`)).toHaveCount(0)
    await toggle.click()
    const revokedRow = page.getByTestId(`revoked-row-${subjectId}`)
    await expect(revokedRow).toBeVisible()
    // The PERMISSION they last held. `73ec00d`'s own hint says the projection keeps who and the
    // last permission, never the permission at revoke time, so this is the whole of what the row
    // promises. Identity is already carried by the testid — it is `keyOf(grant.subject)`, read off
    // the member row before the revoke, so a history listing the wrong person finds no element.
    //
    // By TESTID against the catalogue, the way S14 does it. The row also carries the subject's name
    // and a formatted date, so a loose text match could land on either; and the label is translated,
    // so a literal would be a false red the moment the account is left in Dutch.
    const badge = revokedRow.getByTestId('permission-badge')
    await expect(badge).toHaveCount(1)
    expect(PERMISSION_LABELS).toContain((await badge.innerText()).trim())

    // Restore writes IMMEDIATELY — it calls the grant mutation and then `onDone()`, unlike every
    // other edit in this sheet, which is staged into the draft and committed by Save. Clicking Save
    // after it waits forever on a button that was never going to enable.
    await page.getByTestId(`revoked-restore-${subjectId}`).click()
    await expect(panel).toBeHidden()

    // Both halves of `if (live.has(key)) continue`, read back from the node: they are a member
    // again, AND they are no longer former. Asserting only the first would pass on a history that
    // lists someone who currently has access.
    await openShare()
    await expect(page.getByTestId(`share-member-${subjectId}`)).toBeVisible()
    await expect(page.getByTestId('revoked-toggle')).toHaveCount(0)
  })
})
