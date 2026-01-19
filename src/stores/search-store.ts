import { createStoreWithDevtools } from './utils/store-utils'
import { useSDKStore } from './sdk-store'
import { logger } from '@/lib/logger'
import {
  parseSearchQuery,
  type ParsedSearch,
  type SearchFilter,
} from '@/lib/search-parser'

export interface SearchPagination {
  currentPage: number
  totalPages: number
  totalElements: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
}

export interface SearchState {
  // Search query state
  query: string
  parsedSearch: ParsedSearch

  // Search execution state
  isSearching: boolean
  searchError: string | null

  // Search mode state
  isSearchMode: boolean

  // Results state
  results: any[]
  pagination: SearchPagination | null

  // UI state
  activeFilters: SearchFilter[]

  // Actions
  setQuery: (query: string) => void
  executeSearch: (parsed?: ParsedSearch) => Promise<void>
  executeSearchInView: (query: string) => Promise<void>
  executeAdvancedSearch: (parsed: ParsedSearch) => Promise<void>
  clearSearch: () => void
  removeFilter: (filter: SearchFilter) => void
  setSearchMode: (isSearchMode: boolean) => void

  // Pagination actions
  goToPage: (page: number) => Promise<void>
  goToFirstPage: () => Promise<void>
  goToPreviousPage: () => Promise<void>
  goToNextPage: () => Promise<void>
  goToLastPage: () => Promise<void>

  // Internal actions
  _setSearching: (isSearching: boolean) => void
  _setError: (error: string | null) => void
  _setResults: (results: any[], pagination: SearchPagination | null) => void
}

const MIN_SEARCH_CHARS = 2
const DEFAULT_PAGE_SIZE = 15

export const useSearchStore = createStoreWithDevtools<SearchState>(
  (set, get) => ({
    // Initial state
    query: '',
    parsedSearch: {
      searchTerm: '',
      filters: [],
      searchBy: {},
    },
    isSearching: false,
    searchError: null,
    isSearchMode: false,
    results: [],
    pagination: null,
    activeFilters: [],

    // Set search query and parse it
    setQuery: (query) => {
      const parsed = parseSearchQuery(query)
      const activeFilters = parsed.filters.filter((f) => f.type !== 'text')

      set((draft) => {
        draft.query = query
        draft.parsedSearch = parsed
        draft.activeFilters = activeFilters
      })
    },

    // Execute search with current parsed query
    executeSearch: async (customParsed) => {
      const state = get()
      const parsed = customParsed || state.parsedSearch

      if (state.isSearching) {
        return
      }

      // Validate search query
      if (parsed.searchTerm && parsed.searchTerm.length < MIN_SEARCH_CHARS) {
        set((draft) => {
          draft.searchError = `Search term must be at least ${MIN_SEARCH_CHARS} characters`
        })
        return
      }

      await get().executeSearchWithPagination(parsed, 0)
    },

    // Execute search in view mode
    executeSearchInView: async (query) => {
      get().setQuery(query)
      get().setSearchMode(true)
      await get().executeSearch()
    },

    // Execute advanced search with parsed query
    executeAdvancedSearch: async (parsed) => {
      get().setSearchMode(true)
      await get().executeSearch(parsed)
    },

    // Execute search with pagination
    executeSearchWithPagination: async (
      parsed: ParsedSearch,
      page: number = 0
    ) => {
      set((draft) => {
        draft.isSearching = true
        draft.searchError = null
        draft.parsedSearch = parsed
      })

      try {
        const client = useSDKStore.getState().client

        if (!client) {
          throw new Error('SDK client not initialized')
        }

        logger.debug('Executing search:', { parsed, page })

        // Build search parameters
        const searchParams: any = {
          size: DEFAULT_PAGE_SIZE,
          page: page,
        }

        // Add search term if present
        if (parsed.searchTerm && parsed.searchTerm.trim()) {
          searchParams.searchTerm = parsed.searchTerm.trim()
        }

        // Merge parsed searchBy - the parser already builds the correct structure
        if (Object.keys(parsed.searchBy).length > 0) {
          searchParams.searchBy = {
            ...parsed.searchBy,
            // Ensure we don't search deleted items by default
            softDeleted: false,
          }
        } else {
          searchParams.searchBy = { softDeleted: false }
        }

        // Execute search via SDK
        const response = await client.node.searchAggregates(searchParams)

        // Build pagination info
        const pagination: SearchPagination = {
          currentPage: response.number || 0,
          totalPages: response.totalPages || 0,
          totalElements: response.totalElements || 0,
          pageSize: response.size || DEFAULT_PAGE_SIZE,
          isFirstPage: response.first || false,
          isLastPage: response.last || false,
        }

        set((draft) => {
          draft.results = response.content || []
          draft.pagination = pagination
          draft.isSearching = false
          draft.searchError = null
        })

        logger.debug('Search completed:', {
          resultsCount: response.content?.length || 0,
          totalElements: pagination.totalElements,
        })
      } catch (error: any) {
        const errorMessage = error.message || 'Search failed'

        logger.error('Search error:', error)

        set((draft) => {
          draft.isSearching = false
          draft.searchError = errorMessage
          draft.results = []
          draft.pagination = null
        })
      }
    },

    // Clear search state
    clearSearch: () => {
      set((draft) => {
        draft.query = ''
        draft.parsedSearch = {
          searchTerm: '',
          filters: [],
          searchBy: {},
        }
        draft.results = []
        draft.pagination = null
        draft.isSearchMode = false
        draft.activeFilters = []
        draft.searchError = null
      })
    },

    // Remove a specific filter
    removeFilter: (filterToRemove) => {
      const state = get()
      const updatedFilters = state.parsedSearch.filters.filter(
        (f) => f !== filterToRemove
      )

      // Rebuild search query without this filter
      const newSearchTerm = updatedFilters
        .filter((f) => f.type === 'text')
        .map((f) => f.value)
        .join(' ')

      const newParsed: ParsedSearch = {
        searchTerm: newSearchTerm,
        filters: updatedFilters,
        searchBy: updatedFilters.reduce(
          (acc, filter) => {
            if (filter.type !== 'text') {
              acc[filter.key] = filter.value
            }
            return acc
          },
          {} as Record<string, any>
        ),
      }

      set((draft) => {
        draft.parsedSearch = newParsed
        draft.activeFilters = updatedFilters.filter((f) => f.type !== 'text')
      })

      // Re-execute search if in search mode
      if (state.isSearchMode) {
        get().executeSearch(newParsed)
      }
    },

    // Set search mode
    setSearchMode: (isSearchMode) => {
      set((draft) => {
        draft.isSearchMode = isSearchMode
      })
    },

    // Pagination actions
    goToPage: async (page) => {
      const state = get()
      if (state.pagination && page >= 0 && page < state.pagination.totalPages) {
        await get().executeSearchWithPagination(state.parsedSearch, page)
      }
    },

    goToFirstPage: async () => {
      await get().goToPage(0)
    },

    goToPreviousPage: async () => {
      const state = get()
      if (state.pagination && !state.pagination.isFirstPage) {
        await get().goToPage(state.pagination.currentPage - 1)
      }
    },

    goToNextPage: async () => {
      const state = get()
      if (state.pagination && !state.pagination.isLastPage) {
        await get().goToPage(state.pagination.currentPage + 1)
      }
    },

    goToLastPage: async () => {
      const state = get()
      if (state.pagination) {
        await get().goToPage(state.pagination.totalPages - 1)
      }
    },

    // Internal actions
    _setSearching: (isSearching) => {
      set((draft) => {
        draft.isSearching = isSearching
      })
    },

    _setError: (error) => {
      set((draft) => {
        draft.searchError = error
      })
    },

    _setResults: (results, pagination) => {
      set((draft) => {
        draft.results = results
        draft.pagination = pagination
      })
    },
  }),
  {
    name: 'search-store',
  }
)

// Selectors for performance optimization
export const searchSelectors = {
  query: (state: SearchState) => state.query,
  parsedSearch: (state: SearchState) => state.parsedSearch,
  isSearching: (state: SearchState) => state.isSearching,
  searchError: (state: SearchState) => state.searchError,
  isSearchMode: (state: SearchState) => state.isSearchMode,
  results: (state: SearchState) => state.results,
  pagination: (state: SearchState) => state.pagination,
  activeFilters: (state: SearchState) => state.activeFilters,
  hasResults: (state: SearchState) => state.results.length > 0,
  resultsCount: (state: SearchState) => state.results.length,
  totalElements: (state: SearchState) => state.pagination?.totalElements || 0,
}
