import { expect, test } from '../fixtures/app'
import {
  CAPPED_TOTAL,
  localeNumber,
  nextUntil,
  onPage,
  serveObjectList,
  type PageAnswer,
} from '../utils/capped-list'

/**
 * The objects table over a list the node capped at 1001. Every answer is crafted (see
 * `serveObjectList`), so nothing is written and the spec is `.read.`. Assertions are locale-free:
 * the account language is stored state, so "1,000+" and "1.000+" both have to pass.
 */

const full = (): PageAnswer => ({ rows: 'full' })
const MORE_THAN_1000 = /1[.,]000\+/

async function open(page: import('@playwright/test').Page) {
  await page.goto('/objects')
  await expect(page.getByTestId('data-table-row').first()).toBeVisible()
}

test.describe('02 - objects list / capped totals', () => {
  test('L30: a capped total reads 1,000+, with no last-page control', async ({
    page,
  }) => {
    const list = await serveObjectList(page, full)
    await open(page)

    await expect(page.getByTestId('page-indicator')).toContainText(
      MORE_THAN_1000
    )
    await expect(page.getByTestId('page-of')).toHaveText(
      new RegExp(`${list.cappedPages()}\\+$`)
    )
    await expect(page.getByTestId('page-last')).toHaveCount(0)
    await expect(
      page.getByTestId(`page-number-${Math.min(5, list.cappedPages())}`)
    ).toBeVisible()
  })

  test('L31: next pages past the reported page count', async ({ page }) => {
    const list = await serveObjectList(page, full)
    await open(page)
    const past = list.cappedPages() + 1

    await nextUntil(page, past)

    // Past the reported count the line names only the page, with no "of".
    await expect(page.getByTestId('page-of')).toHaveText(
      new RegExp(`^\\D*${past}$`)
    )
    await expect(page.getByTestId('page-next')).toBeEnabled()
    const first = (past - 1) * list.size() + 1
    const last = past * list.size()
    // The range ends at the rows on the page, not at the capped total ("1,181–1,001").
    await expect(page.getByTestId('page-indicator')).toContainText(
      new RegExp(
        `${localeNumber(first)}\\D+${localeNumber(last)}\\D+1[.,]000\\+`
      )
    )
  })

  test('L32: a short page ends the list and keeps the keyboard on previous', async ({
    page,
  }) => {
    let end = Infinity
    const list = await serveObjectList(page, (n) =>
      n >= end ? { rows: 5 } : full()
    )
    await open(page)
    end = list.cappedPages() + 1

    await nextUntil(page, end - 1)
    await page.getByTestId('page-next').focus()
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('page-of')).toHaveText(onPage(end))
    await expect(page.getByTestId('page-next')).toBeDisabled()
    await expect(page.getByTestId('page-prev')).toBeFocused()
  })

  test('L33: an empty page after the end says so and offers previous', async ({
    page,
  }) => {
    let end = Infinity
    const list = await serveObjectList(page, (n) =>
      n >= end ? { rows: 0 } : full()
    )
    await open(page)
    end = list.cappedPages() + 1

    await nextUntil(page, end - 1)
    await page.getByTestId('page-next').click()

    await expect(page.getByTestId('page-of')).toHaveText(onPage(end))
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('page-prev')).toBeEnabled()
    // A capped total does not say where the list ends, so there is no page to jump to.
    await expect(page.getByTestId('page-go-last')).toHaveCount(0)
  })

  test('L34: an empty page past an exact total offers its last page', async ({
    page,
  }) => {
    let empty = Infinity
    const list = await serveObjectList(page, (n) =>
      n >= empty ? { rows: 0, total: 900 } : full()
    )
    await open(page)
    empty = list.cappedPages() + 1

    await nextUntil(page, empty - 1)
    await page.getByTestId('page-next').click()
    await page.getByTestId('page-go-last').click()

    await expect(page.getByTestId('page-of')).toHaveText(
      onPage(Math.ceil(900 / list.size()))
    )
  })

  test('L35: a deep page that fails keeps first and previous', async ({
    page,
  }) => {
    let failing = Infinity
    const list = await serveObjectList(page, (n) =>
      n >= failing ? { status: 422 } : full()
    )
    await open(page)
    failing = list.cappedPages() + 1

    await nextUntil(page, failing - 1)
    await page.getByTestId('page-next').click()

    await expect(page.getByTestId('page-of')).toHaveText(
      new RegExp(`^\\D*${failing}$`)
    )
    await expect(page.getByTestId('page-prev')).toBeEnabled()
    await expect(page.getByTestId('page-first')).toBeEnabled()
  })

  test('L36: child counts read 1,000+ when capped and a dash when not counted', async ({
    page,
  }) => {
    await serveObjectList(page, () => ({
      rows: 3,
      total: 3,
      childCounts: [CAPPED_TOTAL, undefined, 0],
    }))
    await open(page)

    const rows = page.getByTestId('data-table-row')
    const uncounted = (i: number) =>
      rows.nth(i).getByTestId('count-unavailable')
    await expect(rows.nth(0)).toContainText(MORE_THAN_1000)
    await expect(uncounted(0)).toHaveCount(0)
    await expect(uncounted(1)).toHaveCount(1)
    await expect(rows.nth(2)).not.toContainText(MORE_THAN_1000)
    await expect(uncounted(2)).toHaveCount(0)
  })
})
