import { searchText } from '@/lib/search-text'

import { useDebouncedValue } from './use-debounced-value'

/** The `q` for a type-to-search picker: `searchText(raw)`, once typing has stopped. */
export function useDebouncedSearch(raw: string): string | undefined {
  return useDebouncedValue(searchText(raw))
}
