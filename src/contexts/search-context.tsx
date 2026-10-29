'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import type {
  ListSearch,
  ParsedSearch,
  SearchListType,
} from '@/components/global-search/search-parser'
import {
  filtersToDisplayString,
  parseSearchQuery,
  templateSearch,
  toListParams,
} from '@/components/global-search/search-parser'

interface SearchContextType {
  searchQuery: string
  parsedSearch: ParsedSearch | null
  setSearchQuery: (query: string) => void
  isSearchMode: boolean
  executeAdvancedSearch: (query: string) => void
  executeSearchFromParsed: (parsed: ParsedSearch) => void
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

const MIN_SEARCH_CHARS = 2

// The list pages that apply a search. A search started on one of them stays there; started
// anywhere else, it goes to the objects list (or the templates list for `template:true`).
const OBJECTS_PAGE = '/objects'
const MODELS_PAGE = '/templates'
const LIST_PAGES = [
  OBJECTS_PAGE,
  '/processes',
  MODELS_PAGE,
  '/formulas',
  '/constants',
  '/shares',
] as const
type ListPage = (typeof LIST_PAGES)[number]

/** The list a path belongs to: the list page itself or a page under it, such as a detail page. */
function listRootOf(pathname: string): ListPage | null {
  return (
    LIST_PAGES.find(
      (page) => pathname === page || pathname.startsWith(`${page}/`)
    ) ?? null
  )
}

/**
 * The active search TERM — no results, no requests.
 *
 * It used to run its own `searchAggregates` mutation against the retired node and hold the results,
 * while each page ALSO passed `q` to its io2p list. So `/objects` answered one question with two
 * backends: the results bar counted the legacy response and the table below rendered the io2p one.
 *
 * Worse, the catch set `isSearchMode(false)` — and every page gates its `q` on that flag. A failing
 * request to a backend nothing else uses therefore turned search off across the WHOLE app, silently
 * and identically to "no matches".
 *
 * So this holds the parsed search and a flag. Each list maps it with `useListSearch(type)`, which
 * keeps only the params that list takes.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  // The parsed filters a list sends. The display string is for the input box only.
  const [parsedSearch, setParsedSearch] = useState<ParsedSearch | null>(null)
  const [isSearchMode, setIsSearchMode] = useState(false)
  // The list page the active search belongs to, so moving to another list clears a search that
  // no longer means anything there.
  const [searchAnchor, setSearchAnchor] = useState<ListPage | null>(null)

  const pathname = usePathname()
  const router = useRouter()

  const clearSearch = () => {
    setSearchQuery('')
    setParsedSearch(null)
    setIsSearchMode(false)
    setSearchAnchor(null)
  }

  /**
   * `template:true|false` picks /templates or /objects. Without it, a search stays on the list page
   * it was started from, and one started from any other page goes to /objects.
   */
  const resolveSearchPage = (parsed: ParsedSearch): ListPage => {
    const template = templateSearch(parsed)
    const target: ListPage =
      template !== undefined
        ? template
          ? MODELS_PAGE
          : OBJECTS_PAGE
        : (LIST_PAGES.find((page) => page === pathname) ?? OBJECTS_PAGE)

    if (pathname !== target) {
      router.push(target)
    }
    return target
  }

  const applySearch = (parsed: ParsedSearch, displayQuery: string) => {
    setSearchQuery(displayQuery)
    setParsedSearch(parsed)
    setSearchAnchor(resolveSearchPage(parsed))
    setIsSearchMode(true)
  }

  const executeAdvancedSearch = (query: string) => {
    if (!query || query.length < MIN_SEARCH_CHARS) {
      clearSearch()
      return
    }
    applySearch(parseSearchQuery(query), query)
  }

  const executeSearchFromParsed = (parsed: ParsedSearch) => {
    // The raw tokens, so reopening the search box and pressing Enter parses to the same filters.
    applySearch(parsed, filtersToDisplayString(parsed.filters))
  }

  // Leaving the anchored list drops the search — DERIVED, not synchronised. Clearing it in an
  // effect meant a render where the search still looked active on a page it does not belong to,
  // and the compiler lint rejects setState in an effect anyway. A detail page under the anchored
  // list keeps it, so going back shows the same results.
  const active = isSearchMode && listRootOf(pathname) === searchAnchor

  return (
    <SearchContext.Provider
      value={{
        searchQuery: active ? searchQuery : '',
        parsedSearch: active ? parsedSearch : null,
        setSearchQuery,
        isSearchMode: active,
        executeAdvancedSearch,
        executeSearchFromParsed,
        clearSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

/** What the active search asks of a list of `type`, or null when no search is active. */
export function useListSearch(type: SearchListType): ListSearch | null {
  const { parsedSearch } = useSearch()
  return useMemo(
    () => (parsedSearch ? toListParams(parsedSearch, type) : null),
    [parsedSearch, type]
  )
}
