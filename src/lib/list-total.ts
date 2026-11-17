// The node answers 1001 for "more than 1,000" on the object, process, formula, constant and
// template lists and on child counts only; elsewhere 1001 is exact, so the caller names the list.
export const TOTAL_CAP = 1000
export const CAPPED_TOTAL = TOTAL_CAP + 1

export function isCappedTotal(
  total: number | undefined,
  capped: boolean
): boolean {
  return capped && total === CAPPED_TOTAL
}

/** For a count the node always caps: a child count, or the total of a capped list. */
export function isCappedCount(count: number | undefined): boolean {
  return isCappedTotal(count, true)
}

/** An absent `childCount` means the node ran out of time to count, not that there are none. */
export function mayHaveChildren(childCount: number | undefined): boolean {
  return childCount !== 0
}

/**
 * Whether this page is the last one. A capped total does not say where the list ends; a page with
 * fewer rows than asked does.
 */
export function isLastListPage({
  capped,
  page,
  totalPages,
  rows,
  size,
}: {
  capped: boolean
  page: number // 1-based
  totalPages: number
  rows: number
  size: number
}): boolean {
  return capped ? rows < size : totalPages === 0 || page >= totalPages
}

/**
 * The sum of several totals. A capped one adds `TOTAL_CAP`, so the result is a lower limit to show
 * as "{total}+" whenever `capped` is true.
 */
export function sumTotals(
  totals: readonly number[],
  capped: boolean
): { total: number; capped: boolean } {
  return totals.reduce<{ total: number; capped: boolean }>(
    (sum, total) =>
      isCappedTotal(total, capped)
        ? { total: sum.total + TOTAL_CAP, capped: true }
        : { total: sum.total + total, capped: sum.capped },
    { total: 0, capped: false }
  )
}
