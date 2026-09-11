'use client'

import React, { createContext, useContext, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import type { ParsedSearch } from '@/components/global-search/search-parser'
import { parseSearchQuery } from '@/components/global-search/search-parser'

interface SearchContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearchMode: boolean
  executeAdvancedSearch: (query: string) => void
  executeSearchFromParsed: (parsed: ParsedSearch) => void
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

const MIN_SEARCH_CHARS = 2

// Where a search lands. Every other list filters in place.
const OBJECTS_PAGE = '/objects'
const MODELS_PAGE = '/templates'

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
 * So this holds a string and a flag. Each list applies it through its own `q`, which is the only
 * place that knows what it is listing.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  // Which root page (objects vs templates) the active search belongs to, so crossing to the other
  // root clears a search that no longer means anything there.
  const [searchAnchor, setSearchAnchor] = useState<
    'objects' | 'templates' | null
  >(null)

  const pathname = usePathname()
  const router = useRouter()

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearchMode(false)
    setSearchAnchor(null)
  }

  /**
   * `template:true` routes to /templates, anything else to /objects — and a search started from a
   * page that cannot show results has to land somewhere.
   */
  const resolveSearchPage = (parsed: ParsedSearch) => {
    const explicit = parsed.searchBy.isTemplate
    const isTemplateSearch =
      explicit !== undefined
        ? (explicit as boolean)
        : pathname.startsWith(MODELS_PAGE)
    const target = isTemplateSearch ? MODELS_PAGE : OBJECTS_PAGE

    if (pathname !== target && !pathname.startsWith(target)) {
      router.push(target)
    }
    return isTemplateSearch ? 'templates' : 'objects'
  }

  const applySearch = (parsed: ParsedSearch, displayQuery: string) => {
    setSearchQuery(displayQuery)
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
    const displayQuery =
      [
        parsed.searchTerm,
        ...parsed.filters
          .filter((f) => f.type !== 'text')
          .map((f) => `${f.type}:${f.value}`),
      ]
        .filter(Boolean)
        .join(' ') ||
      parsed.searchTerm ||
      ''
    applySearch(parsed, displayQuery)
  }

  // Crossing the objects ↔ templates boundary drops a search anchored to the other root — DERIVED,
  // not synchronised. Clearing it in an effect meant a render where the search still looked active
  // on a page it does not belong to, and the compiler lint rejects setState in an effect anyway.
  const currentRoot = pathname.startsWith(MODELS_PAGE)
    ? 'templates'
    : pathname.startsWith(OBJECTS_PAGE)
      ? 'objects'
      : null
  const active = isSearchMode && (!searchAnchor || currentRoot === searchAnchor)

  return (
    <SearchContext.Provider
      value={{
        searchQuery: active ? searchQuery : '',
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
