import { useState } from 'react'

import { nextSearch, type SearchKind, searchInput } from '@/lib/search-text'

import { useDebouncedValue } from './use-debounced-value'

/** The `q` for a type-to-search picker, once typing has stopped. See `nextSearch`. */
export function useDebouncedSearch(
  raw: string,
  kind: SearchKind
): string | undefined {
  const debounced = useDebouncedValue(raw)
  const [last, setLast] = useState<string | undefined>(undefined)
  const q = nextSearch(searchInput(debounced, kind), last)
  if (q !== last) setLast(q)
  return q
}
