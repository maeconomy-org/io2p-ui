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

/** An absent `childCount` means the node ran out of time to count, not that there are none. */
export function mayHaveChildren(childCount: number | undefined): boolean {
  return childCount !== 0
}
