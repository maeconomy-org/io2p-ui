'use client'

import * as React from 'react'
import {
  Search,
  X,
  Trash2,
  Layout,
  Tag,
  Type,
  User,
  FolderTree,
  ArrowRight,
  Sparkles,
  Clock,
  Command as CommandIcon,
  Hash,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useHotkeys } from 'react-hotkeys-hook'

import { cn } from '@/lib/utils'
import {
  parseSearchQuery,
  getFilterSuggestions,
  removeFilter,
  type SearchFilter,
  type FilterSuggestion,
  type ParsedSearch,
} from '@/lib/search-parser'
import {
  Badge,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui'

interface CommandCenterProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSearch?: (parsed: ParsedSearch) => void
  initialQuery?: string
}

const ICON_MAP: Record<string, React.ElementType> = {
  Trash2,
  Layout,
  Tag,
  Type,
  User,
  FolderTree,
  Hash,
}

// Recent searches (could be persisted to localStorage in future)
const getRecentSearches = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('iom-recent-searches')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const saveRecentSearch = (query: string) => {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const recent = getRecentSearches()
    const filtered = recent.filter((s) => s !== query)
    const updated = [query, ...filtered].slice(0, 5)
    localStorage.setItem('iom-recent-searches', JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

export function CommandCenter({
  open,
  onOpenChange,
  onSearch,
  initialQuery = '',
}: CommandCenterProps) {
  const t = useTranslations()
  const [inputValue, setInputValue] = React.useState(initialQuery)
  const [parsedSearch, setParsedSearch] = React.useState<ParsedSearch>({
    searchTerm: '',
    filters: [],
    searchBy: {},
  })
  const [showSuggestions] = React.useState(true)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [recentSearches, setRecentSearches] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Load recent searches on mount
  React.useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [open])

  // Parse input whenever it changes
  React.useEffect(() => {
    const parsed = parseSearchQuery(inputValue)
    setParsedSearch(parsed)
  }, [inputValue])

  // Focus input when dialog opens and pre-fill with initial query
  React.useEffect(() => {
    if (open) {
      // Pre-fill with initial query when opening
      if (initialQuery) {
        setInputValue(initialQuery)
      }
      setTimeout(() => {
        inputRef.current?.focus()
        // Select all text so user can easily replace
        inputRef.current?.select()
      }, 50)
    } else {
      setSelectedIndex(0)
    }
  }, [open, initialQuery])

  // Get current suggestions based on input
  const currentSuggestions = React.useMemo(() => {
    // Get the last token being typed
    const tokens = inputValue.split(' ')
    const lastToken = tokens[tokens.length - 1] || ''

    // Only show suggestions if the last token looks like a filter prefix
    if (lastToken.includes(':')) {
      return [] // Already has a value, don't suggest
    }

    return getFilterSuggestions(lastToken)
  }, [inputValue])

  // Active filters (non-text filters)
  const activeFilters = parsedSearch.filters.filter((f) => f.type !== 'text')

  const handleRemoveFilter = (filter: SearchFilter) => {
    const newQuery = removeFilter(parsedSearch.filters, filter)
    setInputValue(newQuery)
  }

  const handleSuggestionClick = (suggestion: FilterSuggestion) => {
    // Append the filter prefix to input
    const tokens = inputValue.trim().split(' ')
    const lastToken = tokens[tokens.length - 1] || ''

    // If last token is partial match of the suggestion, replace it
    if (
      lastToken &&
      !lastToken.includes(':') &&
      suggestion.prefix.toLowerCase().startsWith(lastToken.toLowerCase())
    ) {
      tokens[tokens.length - 1] = suggestion.prefix
    } else {
      tokens.push(suggestion.prefix)
    }

    setInputValue(tokens.filter(Boolean).join(' '))
    inputRef.current?.focus()
  }

  const handleRecentClick = (query: string) => {
    setInputValue(query)
    inputRef.current?.focus()
  }

  const handleSearch = () => {
    // Allow search if there's any input or any filters
    if (!inputValue.trim()) return

    // Save to recent searches
    saveRecentSearch(inputValue)

    // Trigger search callback
    onSearch?.(parsedSearch)
    onOpenChange?.(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    } else if (e.key === 'Escape') {
      onOpenChange?.(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        Math.min(prev + 1, currentSuggestions.length - 1)
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Tab' && currentSuggestions.length > 0) {
      e.preventDefault()
      handleSuggestionClick(currentSuggestions[selectedIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-gradient-to-b from-background to-muted/20 border-border/50 shadow-2xl [&>button]:hidden">
        {/* Visually hidden title and description for accessibility */}
        <DialogTitle className="sr-only">
          {t('commandCenter.title')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('commandCenter.description')}
        </DialogDescription>

        {/* Search Header */}
        <div className="relative border-b border-border/50 bg-background/80 backdrop-blur-sm">
          {/* Close button */}
          <button
            onClick={() => onOpenChange?.(false)}
            className="absolute right-4 top-3 p-1 hover:bg-muted rounded-md transition-colors z-10"
            aria-label={t('commandCenter.closeSearch')}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center px-4 py-3 pr-12">
            <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('commandCenter.placeholder')}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="p-1 hover:bg-muted rounded-md transition-colors ml-2"
                aria-label={t('commandCenter.clearInput')}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Active Filters Pills */}
          {activeFilters.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors text-xs"
                >
                  {filter.type === 'deleted' && <Trash2 className="h-3 w-3" />}
                  {filter.type === 'template' && <Layout className="h-3 w-3" />}
                  {filter.type === 'property' && <Tag className="h-3 w-3" />}
                  {filter.type === 'propertyLabel' && (
                    <Tag className="h-3 w-3" />
                  )}
                  {filter.type === 'propertyValue' && (
                    <Hash className="h-3 w-3" />
                  )}
                  {filter.type === 'name' && <Type className="h-3 w-3" />}
                  {filter.type === 'createdBy' && <User className="h-3 w-3" />}
                  {filter.type === 'parent' && (
                    <FolderTree className="h-3 w-3" />
                  )}
                  <span className="font-medium">{filter.label}</span>
                  <button
                    onClick={() => handleRemoveFilter(filter)}
                    className="ml-0.5 p-0.5 hover:bg-primary/20 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="max-h-[400px] overflow-y-auto">
          {/* Filter Suggestions */}
          {showSuggestions && currentSuggestions.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {t('commandCenter.filters')}
              </div>
              {currentSuggestions.map((suggestion, index) => {
                const Icon = ICON_MAP[suggestion.icon] || Tag
                return (
                  <button
                    key={suggestion.type}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                        index === selectedIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {t(suggestion.labelKey)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t(suggestion.descriptionKey)}
                      </div>
                    </div>
                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {suggestion.examples[0]}
                    </code>
                  </button>
                )
              })}
            </div>
          )}

          {/* Recent Searches */}
          {!inputValue && recentSearches.length > 0 && (
            <div className="p-2 border-t border-border/50">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {t('commandCenter.recent')}
              </div>
              {recentSearches.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentClick(query)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted/50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{query}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {!inputValue && (
            <div className="p-2 border-t border-border/50">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CommandIcon className="h-3 w-3" />
                {t('commandCenter.quickActions')}
              </div>
              <button
                onClick={() => setInputValue('deleted:true ')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {t('commandCenter.viewDeleted')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('commandCenter.viewDeletedDescription')}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-4 py-2.5 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                ↵
              </kbd>
              <span>{t('commandCenter.search')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                Tab
              </kbd>
              <span>{t('commandCenter.complete')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono shadow-sm">
                Esc
              </kbd>
              <span>{t('commandCenter.close')}</span>
            </span>
          </div>
          {parsedSearch.searchTerm && (
            <div className="flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              <span>
                {t('commandCenter.searchingFor', {
                  query: parsedSearch.searchTerm,
                })}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to manage command center state globally
export function useCommandCenter() {
  const [open, setOpen] = React.useState(false)

  // Register global hotkey
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault()
      setOpen(true)
    },
    {
      enableOnFormTags: ['INPUT', 'TEXTAREA', 'SELECT'],
    }
  )

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
  }
}
