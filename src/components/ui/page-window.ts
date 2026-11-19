export interface PageWindowInput {
  currentPage: number // 0-based
  totalPages: number
  capped: boolean
  isLastPage: boolean
  maxButtons: number
}

export interface PageWindow {
  knownPages: number
  pageNumbers: number[]
  pageLine: 'pageOf' | 'pageOfAtLeast' | 'pageOnly'
}

export function pageWindow({
  currentPage,
  totalPages,
  capped,
  isLastPage,
  maxButtons,
}: PageWindowInput): PageWindow {
  // A capped `totalPages` is a lower limit, so those pages exist; one more is reachable while this
  // page is full. Past an exact total that shrank, the page the user is on still has to show.
  const knownPages = Math.max(
    totalPages,
    capped ? currentPage + (isLastPage ? 1 : 2) : 0,
    currentPage + 1
  )

  const count = Math.min(knownPages, maxButtons)
  const first =
    knownPages <= count || currentPage <= 1
      ? 0
      : currentPage >= knownPages - 2
        ? knownPages - count
        : currentPage - 1
  const pageNumbers = Array.from({ length: count }, (_, i) => first + i)

  const pageLine =
    currentPage + 1 > totalPages
      ? 'pageOnly'
      : capped
        ? 'pageOfAtLeast'
        : 'pageOf'

  return { knownPages, pageNumbers, pageLine }
}
