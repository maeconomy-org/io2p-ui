import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { nextUntil, onPage } from '../utils/capped-list'
import { CAPPED_PARENT } from '../utils/seed-objects'
import { restoreSession, signedOutContext, signInAs } from '../utils/session'
import { gotoList } from '../utils/sheet'
import { OBJECT_LIST, runSearch } from '../utils/search'

/**
 * A real capped list, end to end: the second account's "Capped parent" holds 1,060 children (the
 * setup keeps them). The node caps the count at 1001, so the UI reads "1,000+" and pages past the
 * count it was told. Page size is an account preference, so every page number is computed from the
 * size the UI asked for, never assumed to be 20.
 */

const CHILDREN = 1060
const CAPPED = 1001
const MORE_THAN_1000 = /1[.,]000\+/
const second = secondCredentials()
let switchedAccount = false

test.afterAll(async ({ browser }) => {
  if (!switchedAccount) return
  const context = await signedOutContext(browser)
  await restoreSession(await context.newPage())
  await context.close()
})

test.describe('17 - search / a capped list', () => {
  test.skip(!second, 'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local')

  test('SC1: 1,000+ children page past the reported count to an empty page', async ({
    browser,
  }) => {
    test.setTimeout(180_000)
    const context = await signedOutContext(browser)
    const page = await context.newPage()
    await page.goto('/')
    switchedAccount = true
    await signInAs(page, second!)
    await gotoList(page, '/objects')

    await runSearch(page, `name:${CAPPED_PARENT}`)
    const parent = page
      .getByTestId('data-table-row')
      .filter({ hasText: CAPPED_PARENT })
    // Exactly one: a second would mean a setup ran twice, and the counts below would be wrong.
    await expect(parent).toHaveCount(1)

    const listed = page.waitForRequest(
      (r) => OBJECT_LIST.test(r.url()) && /parent=[0-9a-f-]{36}/.test(r.url())
    )
    await parent.dblclick()
    const size = Number(new URL((await listed).url()).searchParams.get('size'))
    const reported = Math.ceil(CAPPED / size)
    const last = Math.ceil(CHILDREN / size)

    await expect(page.getByTestId('page-indicator')).toContainText(
      MORE_THAN_1000
    )
    await expect(page.getByTestId('page-of')).toHaveText(
      new RegExp(`\\b1\\D+${reported}\\+$`)
    )

    await nextUntil(page, last)
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    await page.getByTestId('page-next').click()
    await expect(page.getByTestId('page-of')).toHaveText(onPage(last + 1))
    await expect(page.getByTestId('data-table-row')).toHaveCount(0)
    await expect(page.getByTestId('page-next')).toBeDisabled()
    await context.close()
  })
})
