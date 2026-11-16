'use client'

import { createContext, useContext, useMemo, useState } from 'react'

import { searchMarks } from '@/lib/search-marks'

/**
 * `text` with each word of `q` marked, the way the node matched it (case and accents ignored).
 * The marks are inline, so a screen reader reads the name in one piece.
 */
export function SearchHighlight({
  text,
  q,
}: {
  text: string
  q: string | undefined
}) {
  const marks = useMemo(() => searchMarks(text, q), [text, q])
  if (marks.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let at = 0
  for (const [start, end] of marks) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark
        key={start}
        className="rounded-sm bg-mark font-semibold text-mark-foreground forced-colors:bg-[Mark] forced-colors:text-[MarkText]"
      >
        {text.slice(start, end)}
      </mark>
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

// The search a table's rows answer, for the name cells inside it. A table built by shared column
// helpers reads it here rather than through every column builder.
const SearchMarkContext = createContext<string | undefined>(undefined)

export const SearchMarkProvider = SearchMarkContext.Provider

/** `text` marked with the search of the table around it; plain outside one. */
export function MarkedName({ text }: { text: string }) {
  return <SearchHighlight text={text} q={useContext(SearchMarkContext)} />
}

/**
 * The search the rows on screen answer. While a new search loads, the list keeps the old rows
 * (`placeholderData`), and they must keep the old marks.
 */
export function useShownSearch(
  q: string | undefined,
  isPlaceholderData: boolean
): string | undefined {
  const [shown, setShown] = useState(q)
  if (!isPlaceholderData && shown !== q) setShown(q)
  return isPlaceholderData ? shown : q
}
