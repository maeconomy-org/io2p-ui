import { expect, type Page } from '@playwright/test'

/**
 * The node answers 1001 for "more than 1,000" on the object list. A test account never holds that
 * many objects, so the LIST answer is crafted: rows cloned from a real row, and page meta in the
 * exact shape the node sends — `totalElements: 1001`, `totalPages: ceil(1001 / size)`, never a
 * `capped` flag.
 */
export const CAPPED_TOTAL = 1001

export type PageAnswer =
  | {
      /** `'full'` is exactly the size asked for: a page that does not end the list. */
      rows: number | 'full'
      total?: number
      childCounts?: (number | undefined)[]
    }
  | { status: number }

export interface ServedList {
  /** The page size the UI asked for; it is an account preference, so never assumed. */
  size: () => number
  /** `ceil(1001 / size)`, the page count the node reports for a capped total. */
  cappedPages: () => number
}

const rowId = (page: number, index: number) =>
  `00000000-0000-7000-8000-${String(page * 1000 + index).padStart(12, '0')}`

export async function serveObjectList(
  page: Page,
  answer: (pageNumber: number) => PageAnswer
): Promise<ServedList> {
  let size = 0
  let template: Record<string, unknown> | undefined

  // RegExp, not a glob: a glob's `?` is a wildcard and would also swallow `/v1/objects/<id>`.
  await page.route(/\/v1\/objects(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const number = Number(url.searchParams.get('page') ?? 1)
    size = Number(url.searchParams.get('size') ?? 20)

    if (!template) {
      const real = await (await route.fetch()).json()
      template = real.data?.[0] ?? { name: 'Row', deleted: false }
    }

    const planned = answer(number)
    if ('status' in planned) {
      return route.fulfill({
        status: planned.status,
        json: { message: 'refine your search' },
      })
    }

    const total = planned.total ?? CAPPED_TOTAL
    const rows = planned.rows === 'full' ? size : planned.rows
    const data = Array.from({ length: rows }, (_, i) => {
      const row: Record<string, unknown> = {
        ...template,
        id: rowId(number, i),
        name: `Capped ${number}-${i + 1}`,
        cover: undefined,
      }
      const counts = planned.childCounts
      // A hole in `childCounts` is a row the node did not count in time: the field is ABSENT.
      if (counts && i < counts.length && counts[i] === undefined)
        delete row.childCount
      else row.childCount = counts?.[i] ?? 0
      return row
    })

    return route.fulfill({
      json: {
        data,
        page: {
          number,
          size,
          totalElements: total,
          totalPages: Math.ceil(total / size),
        },
      },
    })
  })

  return {
    size: () => size,
    cappedPages: () => Math.ceil(CAPPED_TOTAL / size),
  }
}

/** A number as either locale prints it: 1021 matches "1,021" and "1.021". */
export const localeNumber = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '[.,]')

/** The page line's FIRST number is the page on screen: "Page 4 of 51+" / "Pagina 4 van 51+". */
export const onPage = (n: number) => new RegExp(`^\\D*${n}(\\D|$)`)

/** Press next until `target` is the page on screen; each press waits for its page to land. */
export async function nextUntil(page: Page, target: number): Promise<void> {
  const of = page.getByTestId('page-of')
  for (;;) {
    const shown = Number((await of.innerText()).match(/\d+/)?.[0])
    if (shown >= target) return
    await page.getByTestId('page-next').click()
    await expect(of).toHaveText(onPage(shown + 1))
  }
}
