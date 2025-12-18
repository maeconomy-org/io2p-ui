'use client'

import React, { createContext, useContext, useState } from 'react'

import { logger } from '@/lib'
import { useCommonApi } from '@/hooks/api'

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
  executeSearchInView: (query: string) => Promise<void>
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

const MIN_SEARCH_CHARS = 2

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchPageSize] = useState(15) // Fixed page size for search
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchViewResults, setSearchViewResults] = useState<any[]>([])
  const [searchCurrentPage, setSearchCurrentPage] = useState(0)
  const [searchPaginationData, setSearchPaginationData] = useState<any>(null)
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()

  // Execute search with pagination support
  const executeSearchWithPagination = async (
    query: string,
    page: number = 0
  ) => {
    setIsSearching(true)
    const trimmedQuery = query.trim()

    try {
      // Search with pagination parameters using proper API hook
      const results = await searchMutation.mutateAsync({
        searchTerm: trimmedQuery,
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
  const executeSearchInView = async (query: string) => {
    if (!query || query.length < MIN_SEARCH_CHARS) {
      clearSearch()
      return
    }

    // Reset to first page when starting new search
    await executeSearchWithPagination(query, 0)
  }

  // Pagination handlers
  const handlePageChange = async (page: number) => {
    if (searchQuery) {
      await executeSearchWithPagination(searchQuery, page) // page is already 0-based from TablePagination
    }
  }

  const handleFirst = async () => {
    if (searchQuery) {
      await executeSearchWithPagination(searchQuery, 0)
    }
  }

  const handlePrevious = async () => {
    if (searchQuery && searchCurrentPage > 0) {
      await executeSearchWithPagination(searchQuery, searchCurrentPage - 1)
    }
  }

  const handleNext = async () => {
    if (searchQuery && searchPaginationData && !searchPaginationData.last) {
      await executeSearchWithPagination(searchQuery, searchCurrentPage + 1)
    }
  }

  const handleLast = async () => {
    if (searchQuery && searchPaginationData) {
      await executeSearchWithPagination(
        searchQuery,
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
        executeSearchInView,
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
