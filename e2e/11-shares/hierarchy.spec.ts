import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { requireCredentials, secondCredentials } from '../setup/credentials'
import { restoreSession, signInAs } from '../utils/session'
import { gotoList, openCreateSheet, saveSheet, sheet } from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * A grantee reading children that were shared EXPLICITLY.
 *
 * `/objects/[uuid]` asks the node for `?parent=<id>`, and the node defaults objects to
 * `scope: 'mine'`. The children are the OWNER's objects, so a grantee's children page came back
 * empty and the object looked like a leaf. `page.tsx` passes `scope: 'all'` for exactly this, and
 * nothing proved it. Every object in the bundle is listed by hand here, parent and children alike.
 *
 * ⚠ THIS IS NOT THE CASCADE CASE, and an earlier version of this comment said the cascade did not
 * exist. It does. `POST /v1/access` takes `includeDescendants` — "opt-in subtree share (objects
 * only): the grant also covers the resource's descendants via the ancestors DAG" — and the UI ships
 * the control (`share-editor-sheet.tsx:449-465`, `canCascade` gating it to all-object bundles). The
 * measurement behind the old comment was correct and its generalisation was wrong: a DEFAULT grant
 * reaches only what is listed, which is all `shareWithSecond` creates because it never ticks the
 * box.
 *
 * So Appendix D's case — share a parent, open it as B, watch the children appear — is real, is
 * `includeDescendants: true`, and is still UNCOVERED. The positive path has no e2e case anywhere;
 * SS5 in `share-sheet.spec.ts` only asserts the hint is absent for a formula. Writing it needs a
 * testid on that checkbox first.
 */
const second = secondCredentials()

/**
 * Signing in as the grantee ENDS the primary account's session for the whole origin. `afterAll`,
 * not the test's last step: the run where this matters is the run where the test FAILED.
 */
test.afterAll(async ({ browser }) => {
  if (!second) return
  const context = await browser.newContext()
  const page = await context.newPage()
  await restoreSession(page)

  // The share is a LIVE GRANT to the second account, and leaving it changes what every later
  // `scope=shared` read returns. The parent is a ROOT, so the account gains one per run on top.
  // Both are soft deletes — nothing here is recoverable-by-accident.
  if (created.share) {
    await page.goto('/shares')
    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: created.share })
    if ((await row.count()) > 0) {
      const actions = rowActions(page, 'share', row.first())
      await actions.menu.click()
      await actions.action('delete').click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /delete/i })
        .click()
      await expect(row).toHaveCount(0, { timeout: 15_000 })
    }
  }

  for (const name of created.objects) {
    await gotoList(page, '/objects')
    const row = page.getByTestId('data-table-row').filter({ hasText: name })
    if ((await row.count()) === 0) continue
    const actions = rowActions(page, 'object', row.first())
    await actions.menu.click()
    await actions.action('delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  }

  await context.close()
})

/** What this run made, so the teardown removes it whether or not the case reached its end. */
const created: { objects: string[]; share: string | null } = {
  objects: [],
  share: null,
}

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function createObject(
  page: Page,
  name: string,
  parentName?: string
): Promise<void> {
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

async function shareWithSecond(
  page: Page,
  shareName: string,
  resourceNames: string[]
): Promise<void> {
  await page.goto('/shares')
  await tour(page, 'sharesCreate').click()
  await page.getByTestId('share-name').fill(shareName)

  for (const resourceName of resourceNames) {
    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(resourceName)
    await page
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: resourceName })
      .first()
      .click()
  }

  await page.getByTestId('member-picker').click()
  await page.getByTestId('member-search').fill(second!.email)
  const member = page.locator('[data-testid^="member-option-"]').first()
  await expect(member).toBeVisible()
  await member.click()

  await expect(page.getByTestId('share-save')).toBeEnabled()
  await page.getByTestId('share-save').click()
  await expect(rowFor(page, shareName)).toBeVisible()
}

test.describe('11 - shares / hierarchy', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a grantee is the whole case'
  )

  test('SH1: a grantee sees explicitly-shared children under a shared parent', async ({
    browser,
  }) => {
    const tag = `e2e-${Date.now()}`
    const parent = `${tag}-shared-parent`
    const childA = `${tag}-child-a`
    const childB = `${tag}-child-b`
    const shareName = `${tag}-hierarchy`
    created.objects.push(childA, childB, parent)
    created.share = shareName

    const ownerContext = await browser.newContext()
    const owner = await ownerContext.newPage()
    await signInAs(owner, requireCredentials())

    await owner.goto('/objects')
    await expect(owner.getByTestId('data-table')).toBeVisible()
    await createObject(owner, parent)
    await createObject(owner, childA, parent)
    await createObject(owner, childB, parent)

    await rowFor(owner, parent).dblclick()
    await expect(owner).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    const parentUrl = owner.url()

    // The children are in the bundle too. They stay the OWNER's objects, which is what makes the
    // grantee's children request need `scope: 'all'` — `mine` drops every one of them.
    await shareWithSecond(owner, shareName, [parent, childA, childB])

    const granteeContext = await browser.newContext()
    const grantee = await granteeContext.newPage()
    await signInAs(grantee, second!)

    const childCalls: string[] = []
    grantee.on('request', (request) => {
      const url = new URL(request.url())
      if (
        /\/objects\?/.test(url.pathname + url.search) &&
        !url.search.includes('_rsc')
      ) {
        childCalls.push(url.search)
      }
    })

    await grantee.goto(parentUrl)

    await expect(rowFor(grantee, childA)).toBeVisible({ timeout: 20_000 })
    await expect(rowFor(grantee, childB)).toBeVisible()

    // `scope=mine` here is the regression, and it renders as an object that merely looks childless.
    const parentQuery = childCalls.find((search) => search.includes('parent='))
    expect(parentQuery, 'no children request was made').toBeDefined()
    expect(parentQuery).toContain('scope=all')

    await ownerContext.close()
    await granteeContext.close()
  })
})
