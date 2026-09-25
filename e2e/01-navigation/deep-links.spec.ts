import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { createObjectWithId } from '../utils/process'
import { tour } from '../utils/selectors'
import { gotoList } from '../utils/sheet'

/**
 * N9 — `/shares?share=<id>` opens that bundle's detail, and closing it clears the param.
 *
 * A URL PARAM rather than a `/shares/<id>` route, because the detail is a sheet over this list and
 * a route would fork it into a second presentation of the same thing. That choice is what makes the
 * close half worth a case: the sheet's own state and the URL are two sources for one fact, and
 * `router.replace('/shares')` is the line that keeps them in step. Leave the param behind and a
 * reload reopens a sheet the user just dismissed.
 *
 * `?ref=` on `/processes` is the sibling deep link and is covered by PR16/PR17.
 */

const second = secondCredentials()

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

test.describe('01 - navigation / deep links', () => {
  test.skip(
    !second,
    'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local — a bundle needs a member to save'
  )

  test('N9: ?share= opens the detail, and closing clears the param', async ({
    page,
  }) => {
    const tag = `e2e-${Date.now()}`
    const objectName = `${tag}-n9-res`
    const shareName = `${tag}-n9`

    await createObjectWithId(page, objectName)

    await gotoList(page, '/shares')
    await tour(page, 'sharesCreate').click()
    await page.getByTestId('share-name').fill(shareName)
    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(objectName)
    await page
      .locator('[data-testid^="resource-option-"]')
      .filter({ hasText: objectName })
      .first()
      .click()
    await page.getByTestId('member-picker').click()
    await page.getByTestId('member-search').fill(second!.email)
    const member = page.locator('[data-testid^="member-option-"]').first()
    await expect(member).toBeVisible()
    await member.click()
    await page.getByTestId('share-save').click()
    await expect(rowFor(page, shareName)).toBeVisible()

    // The id comes from the row's own link, never from a guess — a spec has no other way to learn
    // it, and inventing one would test the 404 path instead.
    const row = rowFor(page, shareName)
    await row.getByTestId('share-details-button').click()
    const detail = page.getByRole('dialog')
    await expect(detail).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(detail).toHaveCount(0)

    // A COLD load of the deep link, which is the case: the param has to be read on mount rather
    // than reacted to as a navigation.
    const shareId = await page.evaluate(async (name) => {
      const config = (
        window as unknown as {
          __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
        }
      ).__IOM_CONFIG__
      const minted = await fetch(`${config!.authBaseUrl}/api/auth/token`, {
        credentials: 'include',
      })
      const { token } = (await minted.json()) as { token?: string }
      // `q=` is a SERVER-side free-text name search (`ShareListQuery`), not a page of everything
      // filtered here. The account is never cleaned up and every run of this file, S11, `lifecycle`
      // and `hierarchy` adds a bundle — so a fixed page size is a dated fuse: the day it is passed,
      // `find` returns undefined and the case fails naming the node rather than the accumulation.
      const res = await fetch(
        `${config!.coreBaseUrl}/api/v1/shares?page=1&size=20&q=${encodeURIComponent(name)}`,
        { headers: { authorization: `Bearer ${token}` } }
      )
      const body = (await res.json()) as {
        data?: { id: string; name: string }[]
      }
      return body.data?.find((s) => s.name === name)?.id ?? ''
    }, shareName)
    expect(shareId, 'the share was not found on the node').not.toBe('')

    await page.goto(`/shares?share=${shareId}`)
    const deepLinked = page.getByRole('dialog')
    await expect(deepLinked).toBeVisible()
    await expect(deepLinked).toContainText(shareName)

    // Closing clears the param. Without it the URL still names a sheet that is no longer open, so a
    // reload or a back-button reopens what the user just dismissed.
    await page.keyboard.press('Escape')
    await expect(deepLinked).toHaveCount(0)
    await expect(page).toHaveURL(/\/shares$/)
  })
})
