import { expect, test } from '../fixtures/app'
import { secondCredentials } from '../setup/credentials'
import { restoreSession, signedOutContext, signInAs } from '../utils/session'
import { tour } from '../utils/selectors'
import { gotoList, openCreateSheet } from '../utils/sheet'
import {
  createObject,
  deleteObjects,
  OBJECT_LIST,
  qOf,
  runSearch,
} from '../utils/search'

/**
 * A search finds an object by words without their accents, from the list and from a picker, and
 * never finds another account's object. The run stamp is the second word, so old runs never match.
 */

const STAMP = String(Date.now())
const NAME = `QA-e2e-${STAMP} Ideeën`
const QUERY = `${STAMP} ideeen`
const second = secondCredentials()
const created: string[] = []
let switchedAccount = false

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  const context = await signedOutContext(browser)
  const page = await context.newPage()
  if (switchedAccount) await restoreSession(page)
  else await page.goto('/objects')
  await deleteObjects(page, created)
  await context.close()
})

test.describe('17 - search / find', () => {
  test('SF1: "ideeen" finds "Ideeën", marking both words', async ({ page }) => {
    await gotoList(page, '/objects')
    created.push(await createObject(page, { name: NAME }))

    await runSearch(page, QUERY)
    const row = page.getByTestId('data-table-row').filter({ hasText: NAME })
    await expect(row).toHaveCount(1)
    await expect(row.locator('mark')).toHaveCount(2)

    await runSearch(page, `ideeen ${STAMP}`)
    await expect(row).toHaveCount(1)
    await expect(row.locator('mark')).toHaveCount(2)
  })

  test('SF2: the parents picker finds it by the same two words', async ({
    page,
  }) => {
    await gotoList(page, '/objects')
    await openCreateSheet(page)
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(QUERY)
    await expect(
      page.getByRole('option').filter({ hasText: NAME })
    ).toBeVisible()
  })

  test('SF2b: the share resource picker finds it by the same two words', async ({
    page,
  }) => {
    await gotoList(page, '/shares')
    await tour(page, 'sharesCreate').click()
    await page.getByTestId('resource-picker').click()
    await page.getByTestId('resource-search').fill(QUERY)
    await expect(
      page
        .locator('[data-testid^="resource-option-"]')
        .filter({ hasText: NAME })
    ).toHaveCount(1)
  })

  test('SF3: another account does not find it', async ({ browser }) => {
    test.skip(!second, 'set E2E_EMAIL_2 and E2E_PASSWORD_2 in .env.local')
    const context = await signedOutContext(browser)
    const page = await context.newPage()
    await page.goto('/')
    switchedAccount = true
    await signInAs(page, second!)
    await gotoList(page, '/objects')

    const answered = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === QUERY
    )
    await runSearch(page, QUERY)
    await answered
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: NAME })
    ).toHaveCount(0)
    await context.close()
  })
})
