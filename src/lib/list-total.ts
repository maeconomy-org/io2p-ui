/**
 * The node counts the object, process, formula, constant and template lists (and child counts) up
 * to `TOTAL_CAP` and answers `CAPPED_TOTAL` for "more than 1,000"; `totalPages` is then a lower
 * limit. Other lists (users, shares, access, files, rollup rules, imports) count exactly, so 1001
 * there is a real number: the caller says which kind of list it read.
 */
export const TOTAL_CAP = 1000
export const CAPPED_TOTAL = TOTAL_CAP + 1

export function isCappedTotal(
  total: number | undefined,
  capped: boolean
): boolean {
  return capped && total === CAPPED_TOTAL
}
