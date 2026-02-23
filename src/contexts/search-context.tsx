'use client'

import React, { createContext, useContext, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { logger } from '@/lib'
import { useCommonApi } from '@/hooks/api'
import type { ParsedSearch } from '@/lib/search-parser'
import { parseSearchQuery } from '@/lib/search-parser'

interface SearchContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearching: boolean
  // New search mode functionality
  isSearchMode: boolean
  searchViewResults: any[]
  searchPagination: {
    currentPage: number
    totalPages: number
    totalElements: number
    pageSize: number
    isFirstPage: boolean
    isLastPage: boolean
    handlePageChange: (page: number) => void
    handleFirst: () => void
    handlePrevious: () => void
    handleNext: () => void
    handleLast: () => void
  } | null
  executeAdvancedSearch: (query: string) => Promise<void>
  executeSearchFromParsed: (parsed: ParsedSearch) => void
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

const MIN_SEARCH_CHARS = 2

// Pages where search results are displayed directly
const OBJECTS_PAGE = '/objects'
const MODELS_PAGE = '/models'

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchPageSize] = useState(15) // Fixed page size for search
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchViewResults, setSearchViewResults] = useState<any[]>([])
  const [searchCurrentPage, setSearchCurrentPage] = useState(0)
  const [searchPaginationData, setSearchPaginationData] = useState<any>(null)
  const [currentParsedSearch, setCurrentParsedSearch] =
    useState<ParsedSearch | null>(null)

  const pathname = usePathname()
  const router = useRouter()

  // Use centralized search mutation from useCommonApi
  const { useSearch: useSearchMutation } = useCommonApi()
  const searchMutation = useSearchMutation()
  const searchMutationRef = useRef(searchMutation)
  searchMutationRef.current = searchMutation

  // Determine the isTemplate value based on the current page and parsed filters
  const getIsTemplateForSearch = (
    parsed: ParsedSearch
  ): boolean | undefined => {
    // If user explicitly set template: filter, respect it
    if (parsed.searchBy.isTemplate !== undefined) {
      return parsed.searchBy.isTemplate as boolean
    }
    // On models page, search templates only
    if (pathname.startsWith(MODELS_PAGE)) {
      return true
    }
    // On objects page (or any other page), search objects only
    return false
  }

  // Determine the correct target page for search and redirect if needed
  const resolveSearchPage = (parsed: ParsedSearch): void => {
    const hasTemplateFilter = parsed.searchBy.isTemplate !== undefined
    const isTemplateSearch = hasTemplateFilter
      ? (parsed.searchBy.isTemplate as boolean)
      : pathname.startsWith(MODELS_PAGE)

    const targetPage = isTemplateSearch ? MODELS_PAGE : OBJECTS_PAGE

    // If not on a search-capable page, redirect
    if (
      !pathname.startsWith(OBJECTS_PAGE) &&
      !pathname.startsWith(MODELS_PAGE)
    ) {
      router.push(targetPage)
    } else if (isTemplateSearch && !pathname.startsWith(MODELS_PAGE)) {
      // User used template:true filter while on objects page → redirect to models
      router.push(MODELS_PAGE)
    } else if (
      !isTemplateSearch &&
      pathname.startsWith(MODELS_PAGE) &&
      !hasTemplateFilter
    ) {
      // On models page but no explicit template filter → stay on models, search templates
    }
  }

  // Execute search with pagination support
  const executeSearchWithPagination = async (
    parsed: ParsedSearch,
    page: number = 0
  ) => {
    setIsSearching(true)

    try {
      // Inject isTemplate based on page context
      const isTemplate = getIsTemplateForSearch(parsed)
      const contextSearchBy = {
        ...parsed.searchBy,
        ...(isTemplate !== undefined ? { isTemplate } : {}),
      }

      // Search with pagination parameters using centralized search hook
      const hasFilters = Object.keys(contextSearchBy).length > 0
      const results = await searchMutationRef.current.mutateAsync({
        searchTerm: parsed.searchTerm || undefined,
        searchBy: hasFilters ? contextSearchBy : undefined,
        size: searchPageSize,
        page: page,
      })

      if (results) {
        // Store pagination data
        setSearchPaginationData(results)
        setSearchCurrentPage(page)

        if (results.content && results.content.length > 0) {
          // Transform search results to match view data format
          const transformedResults = results.content.map((result: any) => ({
            ...result,
            hasChildren: result.children && result.children.length > 0,
            childCount: result.children ? result.children.length : 0,
          }))

          setSearchViewResults(transformedResults)
          setIsSearchMode(true)
        } else {
          setSearchViewResults([])
          setIsSearchMode(true)
        }
      }
    } catch (error) {
      logger.error('Search in view failed:', error)
      setSearchViewResults([])
      setSearchPaginationData(null)
      setIsSearchMode(false)
    } finally {
      setIsSearching(false)
    }
  }

  // New search in view functionality
  const executeAdvancedSearch = async (query: string) => {
    if (!query || query.length < MIN_SEARCH_CHARS) {
      clearSearch()
      return
    }

    // Parse the search query
    const parsed = parseSearchQuery(query)
    setCurrentParsedSearch(parsed)

    // Reset to first page when starting new search
    await executeSearchWithPagination(parsed, 0)
  }

  // Execute search from parsed search object (for CommandCenter)
  const executeSearchFromParsed = (parsed: ParsedSearch) => {
    // Reconstruct the display query from the parsed search
    const displayQuery = [
      parsed.searchTerm,
      ...parsed.filters
        .filter((f) => f.type !== 'text')
        .map((f) => `${f.type}:${f.value}`),
    ]
      .filter(Boolean)
      .join(' ')
    setSearchQuery(displayQuery || parsed.searchTerm || '')
    setCurrentParsedSearch(parsed)

    // Redirect to the correct page based on search context
    resolveSearchPage(parsed)

    executeSearchWithPagination(parsed, 0)
  }

  // Pagination handlers
  const handlePageChange = async (page: number) => {
    if (currentParsedSearch) {
      await executeSearchWithPagination(currentParsedSearch, page) // page is already 0-based from TablePagination
    }
  }

  const handleFirst = async () => {
    if (currentParsedSearch) {
      await executeSearchWithPagination(currentParsedSearch, 0)
    }
  }

  const handlePrevious = async () => {
    if (currentParsedSearch && searchCurrentPage > 0) {
      await executeSearchWithPagination(
        currentParsedSearch,
        searchCurrentPage - 1
      )
    }
  }

  const handleNext = async () => {
    if (
      currentParsedSearch &&
      searchPaginationData &&
      !searchPaginationData.last
    ) {
      await executeSearchWithPagination(
        currentParsedSearch,
        searchCurrentPage + 1
      )
    }
  }

  const handleLast = async () => {
    if (currentParsedSearch && searchPaginationData) {
      await executeSearchWithPagination(
        currentParsedSearch,
        searchPaginationData.totalPages - 1
      )
    }
  }

  // Create search pagination object
  const searchPagination = searchPaginationData
    ? {
        currentPage: searchCurrentPage,
        totalPages: searchPaginationData.totalPages || 0,
        totalElements: searchPaginationData.totalElements || 0,
        pageSize: searchPageSize,
        isFirstPage: searchPaginationData.first || false,
        isLastPage: searchPaginationData.last || false,
        handlePageChange,
        handleFirst,
        handlePrevious,
        handleNext,
        handleLast,
      }
    : null

  const clearSearch = () => {
    setSearchQuery('')
    setSearchViewResults([])
    setSearchPaginationData(null)
    setSearchCurrentPage(0)
    setIsSearchMode(false)
    setCurrentParsedSearch(null)
  }

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        isSearching,
        // New search mode functionality
        isSearchMode,
        searchViewResults,
        searchPagination,
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
