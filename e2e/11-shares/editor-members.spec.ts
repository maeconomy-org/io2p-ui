import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { createObject, deleteObjects, nodeCall } from '../utils/search'
import { rowActions, tour } from '../utils/selectors'
import { gotoList } from '../utils/sheet'

/**
 * A member's permission and "include descendants" are written as chosen, read back on reopen, and
 * changed by an edit that sends only the delta. The share is a live grant to the second account,
 * so `afterAll` deletes it and its object through the API whatever the test did.
 */

const STAMP = String(Date.now())
const OBJECT = `QA-e2e-${STAMP} shared`
const SHARE = `QA-e2e-${STAMP} bundle`
const SHARES = /\/v1\/shares(\/[^/?]+)?$/
const second = secondCredentials()
const cleanup: { objectId?: string; shareId?: string } = {}

interface Share {
  id: string
  includeDescendants?: boolean
  members: { userId: string; permission: string }[]
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await gotoList(page, '/objects')
  if (cleanup.shareId) {
    await nodeCall(page, 'DELETE', `/shares/${cleanup.shareId}`)
  }
  if (cleanup.objectId) await deleteObjects(page, [cleanup.objectId])
  await page.close()
})

/** There is no single-share read on the node, so page the owner's list. */
async function readShare(page: Page, id: string): Promise<Share> {
  for (let n = 1; ; n++) {
    const list = await nodeCall<{
      data: Share[]
      page: { totalPages: number }
    }>(page, 'GET', `/shares?page=${n}&size=100`)
    const found = list.data.find((share) => share.id === id)
    if (found) return found
    if (n >= list.page.totalPages) throw new Error(`share ${id} not listed`)
  }
}

async function openEdit(page: Page) {
  await gotoList(page, '/shares')
  const row = page.getByTestId('data-table-row').filter({ hasText: SHARE })
  const actions = rowActions(page, 'share', row)
  await actions.menu.click()
  await actions.action('edit').click()
  await expect(page.getByTestId('share-name')).toHaveValue(SHARE)
}

async function choosePermission(page: Page, userId: string, level: string) {
  await page.getByTestId(`share-member-permission-${userId}`).click()
  await page.getByTestId(`permission-option-${level}`).click()
}

test.describe('11 - shares / member permission and cascade', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!second, 'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local')

  let memberId = ''

  test('S16: a create sends the chosen permission and cascade', async ({
    page,
  }) => {
    await gotoList(page, '/objects')
    cleanup.objectId = await createObject(page, { name: OBJECT })

    await gotoList(page, '/shares')
    await tour(page, 'sharesCreate').click()
    await page.getByTestId('share-name').fill(SHARE)
    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(`${STAMP} shared`)
    await page.getByTestId(`resource-option-${cleanup.objectId}`).click()
    await page.keyboard.press('Escape')

    await page.getByTestId('member-picker').click()
    await page.getByTestId('member-search').fill(second!.email)
    const option = page.locator('[data-testid^="member-option-"]').first()
    memberId = (await option.getAttribute('data-testid'))!.replace(
      'member-option-',
      ''
    )
    await option.click()

    await choosePermission(page, memberId, 'write')
    await page.getByTestId('share-cascade').click()

    const posted = page.waitForResponse(
      (r) => SHARES.test(r.url()) && r.request().method() === 'POST'
    )
    await page.getByTestId('share-save').click()
    const response = await posted
    cleanup.shareId = ((await response.json()) as Share).id
    const body = response.request().postDataJSON()
    expect(body.members).toEqual([{ userId: memberId, permission: 'write' }])
    expect(body.includeDescendants).toBe(true)

    const share = await readShare(page, cleanup.shareId!)
    expect(share.includeDescendants).toBe(true)
    expect(share.members).toEqual([
      expect.objectContaining({ userId: memberId, permission: 'write' }),
    ])
  })

  test('S17: reopening shows what was saved, and an edit sends only the change', async ({
    page,
  }) => {
    await openEdit(page)
    await expect(page.getByTestId('share-cascade')).toHaveAttribute(
      'data-state',
      'checked'
    )

    await choosePermission(page, memberId, 'read')
    await page.getByTestId('share-cascade').click()
    const patched = page.waitForResponse(
      (r) => SHARES.test(r.url()) && r.request().method() === 'PATCH'
    )
    await page.getByTestId('share-save').click()
    const response = await patched
    expect(response.ok()).toBe(true)
    const body = response.request().postDataJSON()
    expect(body).toEqual({
      includeDescendants: false,
      members: { update: [{ userId: memberId, permission: 'read' }] },
    })

    const share = await readShare(page, cleanup.shareId!)
    expect(share.includeDescendants ?? false).toBe(false)
    expect(share.members).toEqual([
      expect.objectContaining({ userId: memberId, permission: 'read' }),
    ])
  })
})
