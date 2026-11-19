import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { nextUntil, onPage } from '../utils/capped-list'
import { patchPreferences } from '../utils/preferences'
import { CAPPED_PARENT } from '../utils/seed-objects'
import { restoreSession, signedOutContext, signInAs } from '../utils/session'
import { gotoList } from '../utils/sheet'
import { runSearch } from '../utils/search'

/**
 * A real capped list, end to end: the second account's "Capped parent" holds 1,060 children (the
 * setup keeps them). The node caps the count at 1001, so the UI reads "1,000+" and pages past the
 * count it was told. Page size is an account preference, so the spec sets it.
 */

const CHILDREN = 1060
const CAPPED = 1001
const SIZE = 20
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
    // The page size is the account's: set it, so every page number below is known.
    await patchPreferences(page, { defaults: { pageSize: SIZE } })
    await gotoList(page, '/objects')

    await runSearch(page, `name:${CAPPED_PARENT}`)
    const parent = page
      .getByTestId('data-table-row')
      .filter({ hasText: CAPPED_PARENT })
    // Exactly one: a second would mean a setup ran twice, and the counts below would be wrong.
    await expect(parent).toHaveCount(1)

    await parent.dblclick()
    await expect(page.getByTestId('page-indicator')).toContainText(
      MORE_THAN_1000
    )
    const reported = Math.ceil(CAPPED / SIZE)
    const last = Math.ceil(CHILDREN / SIZE)
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
