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
  SlidersHorizontal,
  CalendarDays,
  Ruler,
  Bookmark,
  TriangleAlert,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { SearchMinHint } from '@/components/search-min-hint'
import { savedSearchKey } from '@/constants/preferences'
import {
  type SavedSearchResult,
  useSavedSearches,
} from '@/hooks/ui/use-saved-searches'
import { useObjects } from '@/hooks/api/entities'
import { type SearchKind, searchInput } from '@/lib/search-text'
import { cn } from '@/lib/utils'
import {
  parseSearchQuery,
  searchTextOf,
  templateSearch,
  getFilterSuggestions,
  removeFilter,
  type SearchFilter,
  type FilterSuggestion,
  type ParsedSearch,
  type SearchListType,
} from './search-parser'
import { FilterPanel, type FilterPanelHandle } from './filter-panel'
import { useSearchGrammar } from './use-search-grammar'
import {
  SavedSearchGroup,
  SaveSearchForm,
  useReasonText,
} from './saved-searches'
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
  /** Ends the active search. Without it, an emptied field only empties the field. */
  onClear?: () => void
  initialQuery?: string
  /** How the current list matches `q`. */
  searchKind?: SearchKind
  /** The list a search from here lands on: numbers, dates and folder are for objects only. */
  listType?: SearchListType
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

const EMPTY_RECENT: string[] = []

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
  onClear,
  initialQuery = '',
  searchKind = 'words',
  listType = 'objects',
}: CommandCenterProps) {
  const t = useTranslations()
  /**
   * One opening of the dialog. Everything the dialog used to RESET in an effect — the input, the
   * highlighted suggestion, the recent-search list — is instead stamped with this, so it starts
   * fresh by simply not matching the previous session's stamp.
   */
  // Counted, because open + query alone repeats: typing "mixing" with no active search, then
  // clearing the search, reopened on the same stamp and showed "mixing" again.
  const [openings, setOpenings] = React.useState({ open, count: 0 })
  if (openings.open !== open) {
    setOpenings({ open, count: openings.count + (open ? 1 : 0) })
  }
  const session = `${openings.count}:${open}:${initialQuery}`
  const [typed, setTyped] = React.useState<{
    session: string
    value: string
  } | null>(null)
  const inputValue = typed?.session === session ? typed.value : initialQuery

  const [highlight, setHighlight] = React.useState({
    session,
    index: 0,
    moved: false,
  })
  const current = highlight.session === session
  const selectedIndex = current ? highlight.index : 0
  const highlightMoved = current && highlight.moved
  const setSelectedIndex = (next: number | ((prev: number) => number)) =>
    setHighlight({
      session,
      index: typeof next === 'function' ? next(selectedIndex) : next,
      moved: true,
    })

  const setInputValue = (value: string) => {
    setTyped({ session, value })
    // The suggestions change with the text, so an old arrow choice must not complete on Tab.
    setHighlight({ session, index: 0, moved: false })
  }

  const [panel, setPanel] = React.useState({ session, open: false })
  const panelOpen = panel.session === session && panel.open
  const panelId = React.useId()
  const panelButtonRef = React.useRef<HTMLButtonElement>(null)
  const closePanel = () => {
    setPanel({ session, open: false })
    panelButtonRef.current?.focus()
  }

  // The save row and the panel are never open together, so Escape has one order: picker, row or
  // panel, dialog. The key is minted when the row opens and kept for every retry of that save.
  const [saveRow, setSaveRow] = React.useState<{
    session: string
    key: string
  } | null>(null)
  const saveOpen = saveRow?.session === session && inputValue.trim() !== ''
  const saveRowId = React.useId()
  const saveButtonRef = React.useRef<HTMLButtonElement>(null)
  const closeSaveRow = () => {
    setSaveRow(null)
    saveButtonRef.current?.focus()
  }
  const savedSearches = useSavedSearches()
  const reasonText = useReasonText()
  const [notice, setNotice] = React.useState({ session, text: '' })
  // A save can end after its row closed (Escape, Add filter, an emptied input) or the dialog did;
  // its failure then has no row to show in and goes to a toast.
  const shownRowRef = React.useRef<string | null>(null)
  const shownRow = open && saveOpen ? saveRow.key : null
  React.useEffect(() => {
    shownRowRef.current = shownRow
  }, [shownRow])

  const saveSearch = async (name: string): Promise<SavedSearchResult> => {
    if (!saveRow) return { ok: false, reason: { code: 'busy' } }
    const { key } = saveRow
    const result = await savedSearches.save(key, name, inputValue)
    const rowShown = shownRowRef.current === key
    if (result.ok) {
      setSaveRow((prev) => (prev?.key === key ? null : prev))
      setNotice({
        session,
        text: t('savedSearch.savedAs', { name: name.trim() }),
      })
      if (rowShown) inputRef.current?.focus()
    } else if (!rowShown && result.reason.code !== 'busy') {
      const { text, detail } = reasonText(result.reason)
      toast.error(detail ? `${text} ${detail}` : text)
    }
    return result
  }

  const deleteSearch = async (key: string): Promise<SavedSearchResult> => {
    const result = await savedSearches.remove(key)
    if (result.ok) {
      setNotice({ session, text: t('savedSearch.deleted') })
      inputRef.current?.focus()
    }
    return result
  }

  const [showSuggestions] = React.useState(true)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const hintId = React.useId()
  const panelRef = React.useRef<FilterPanelHandle>(null)
  const problemsId = React.useId()
  const pillsId = React.useId()
  // `template:` sends the search to the templates or objects list, whatever page it started on.
  const kindOf = (parsed: ParsedSearch): SearchKind =>
    templateSearch(parsed) === undefined ? searchKind : 'words'

  // Computed, not stored. As state written by an effect, `parsedSearch` was always one render
  // behind the input it described. `getRecentSearches` is an SSR-safe localStorage read and the
  // list only renders while the dialog is open, so reading it here costs nothing and cannot be
  // stale after a search is saved.
  const recentSearches = open ? getRecentSearches() : EMPTY_RECENT
  const grammar = useSearchGrammar()
  const parsedSearch: ParsedSearch = React.useMemo(
    () => parseSearchQuery(inputValue, grammar),
    [inputValue, grammar]
  )

  // A real side effect: moving focus is something only the DOM can do.
  React.useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      inputRef.current?.focus()
      // Select all text so the user can simply type over it.
      inputRef.current?.select()
    }, 50)
    return () => clearTimeout(id)
  }, [open])

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
  const problems = activeFilters.filter((f) => f.problem)

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

  const clearInput = () => {
    setInputValue('')
    onClear?.()
    inputRef.current?.focus()
  }

  const handleSearch = () => {
    // Values typed in the open panel count as applied: Enter must not drop them unseen.
    const pending = panelOpen
      ? (panelRef.current?.pendingQuery() ?? null)
      : null
    if (pending === 'invalid') return
    const query = pending ?? inputValue
    if (pending !== null) {
      setInputValue(query)
      setPanel({ session, open: false })
    }

    // An empty submit is the way back to the unfiltered list, not a no-op.
    if (!query.trim()) {
      onClear?.()
      onOpenChange?.(false)
      return
    }

    // Parse inline to avoid stale state from useEffect
    const freshParsed = parseSearchQuery(query, grammar)
    // The hint under the input says why; the list keeps its last search.
    const input = searchInput(searchTextOf(freshParsed), kindOf(freshParsed))
    if (input.status === 'refused' && input.problem === 'too-many-words') {
      return
    }

    saveRecentSearch(query)
    onSearch?.(freshParsed)
    onOpenChange?.(false)
  }

  // Tab completes a filter name being typed, or the suggestion the arrows moved to. Otherwise it
  // moves focus, so a keyboard user can reach "Add filter" without changing the search.
  const tabCompletes = (e: React.KeyboardEvent) => {
    if (e.shiftKey || currentSuggestions.length === 0) return false
    const lastToken = inputValue.split(' ').at(-1) ?? ''
    return highlightMoved || lastToken !== ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    } else if (e.key === 'Escape') {
      // The dialog's onEscapeKeyDown decides; the input itself does nothing more.
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        Math.min(prev + 1, currentSuggestions.length - 1)
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Tab' && tabCompletes(e)) {
      e.preventDefault()
      handleSuggestionClick(currentSuggestions[selectedIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          // An open picker inside the panel is its own layer and gets Escape first.
          if (panelOpen) {
            event.preventDefault()
            closePanel()
          } else if (saveOpen) {
            event.preventDefault()
            closeSaveRow()
          }
        }}
        className="w-[calc(100%-2rem)] sm:w-full max-w-2xl rounded-lg [&>*]:min-w-0 p-0 gap-0 overflow-hidden bg-gradient-to-b from-background to-muted/20 border-border/50 shadow-2xl [&>button]:hidden"
      >
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
              data-testid="command-center-input"
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('commandCenter.placeholder')}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={
                problems.length > 0 ? `${hintId} ${problemsId}` : hintId
              }
            />
            <button
              ref={panelButtonRef}
              type="button"
              aria-expanded={panelOpen}
              aria-controls={panelOpen ? panelId : undefined}
              onClick={() => {
                if (panelOpen) return closePanel()
                setSaveRow(null)
                setPanel({ session, open: true })
              }}
              data-testid="add-filter"
              className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {/* A phone has no room for the words beside the input; the name stays. */}
              <span className="sr-only sm:not-sr-only">
                {t('filterPanel.open')}
              </span>
            </button>
            {inputValue.trim() && (
              <button
                ref={saveButtonRef}
                type="button"
                aria-expanded={saveOpen}
                aria-controls={saveOpen ? saveRowId : undefined}
                aria-label={t('savedSearch.open')}
                disabled={!savedSearches.ready}
                onClick={() => {
                  if (saveOpen) return closeSaveRow()
                  setPanel({ session, open: false })
                  setSaveRow({ session, key: savedSearchKey() })
                }}
                data-testid="save-search"
                className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Bookmark className="h-3.5 w-3.5" aria-hidden />
                <span aria-hidden className="hidden sm:inline">
                  {t('savedSearch.openShort')}
                </span>
              </button>
            )}
            {inputValue && (
              <button
                type="button"
                onClick={clearInput}
                data-testid="command-center-clear"
                className="ml-2 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('commandCenter.clearInput')}
              </button>
            )}
          </div>

          <SearchMinHint
            query={searchTextOf(parsedSearch)}
            kind={kindOf(parsedSearch)}
            id={hintId}
          />

          {/* Active Filters Pills */}
          {activeFilters.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              <span id={`${pillsId}-remove`} hidden>
                {t('search.pill.remove')}
              </span>
              {activeFilters.map((filter, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={cn(
                    'pl-2 pr-1 py-1 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors text-xs',
                    filter.problem &&
                      'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15'
                  )}
                >
                  {filter.problem && (
                    <TriangleAlert className="h-3 w-3" aria-hidden />
                  )}
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
                  {(filter.type === 'parent' || filter.type === 'folder') && (
                    <FolderTree className="h-3 w-3" />
                  )}
                  {filter.type === 'number' && <Ruler className="h-3 w-3" />}
                  {(filter.type === 'created' || filter.type === 'updated') && (
                    <CalendarDays className="h-3 w-3" />
                  )}
                  <span id={`${pillsId}-${index}`} className="font-medium">
                    <PillLabel filter={filter} />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFilter(filter)}
                    // Named by the pill text, so an `in:` pill reads its folder, not an id.
                    aria-labelledby={`${pillsId}-remove ${pillsId}-${index}`}
                    className="ml-0.5 p-0.5 hover:bg-primary/20 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {problems.length > 0 && (
            <ul
              id={problemsId}
              data-testid="command-center-problems"
              className="px-4 pb-3 space-y-0.5 text-xs text-destructive"
            >
              {problems.map((filter, index) => (
                <li key={index}>
                  {t('search.notAppliedBecause', {
                    filter: filter.raw,
                    reason: t(`search.problem.${filter.problem}`),
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Content Area */}
        <div className="max-h-[min(400px,60dvh)] overflow-y-auto">
          {saveOpen && (
            <SaveSearchForm
              id={saveRowId}
              query={inputValue}
              ready={savedSearches.ready}
              onSave={saveSearch}
            />
          )}
          {panelOpen && (
            <FilterPanel
              ref={panelRef}
              id={panelId}
              query={inputValue}
              ranges={listType === 'objects'}
              onApply={(query) => {
                setInputValue(query)
                setPanel({ session, open: false })
                inputRef.current?.focus()
              }}
            />
          )}
          {/* Filter Suggestions */}
          {!panelOpen && showSuggestions && currentSuggestions.length > 0 && (
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
                    data-testid={`search-suggestion-${suggestion.type}`}
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
                      {/* On a phone the example moves under the description: beside it, it does not
                          fit, and it is the only place the filter's syntax shows. */}
                      <code className="sm:hidden mt-1 inline-block max-w-full truncate px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                        {suggestion.examples[0]}
                      </code>
                    </div>
                    <code className="hidden sm:inline-block shrink-0 px-2 py-1 bg-muted rounded text-xs font-mono">
                      {suggestion.examples[0]}
                    </code>
                  </button>
                )
              })}
            </div>
          )}

          {!panelOpen && !inputValue && (
            <SavedSearchGroup
              saved={savedSearches.saved}
              unreadable={savedSearches.unreadable}
              busy={savedSearches.pending}
              onRun={handleRecentClick}
              onDelete={deleteSearch}
            />
          )}

          {/* Recent Searches */}
          {!panelOpen && !inputValue && recentSearches.length > 0 && (
            <div className="p-2 border-t border-border/50">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {t('commandCenter.recent')}
              </div>
              {recentSearches.map((query) => (
                <button
                  key={query}
                  data-testid="recent-search"
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
          {!panelOpen && !inputValue && (
            <div className="p-2 border-t border-border/50">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CommandIcon className="h-3 w-3" />
                {t('commandCenter.quickActions')}
              </div>
              <button
                data-testid="quick-view-deleted"
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

        {/* Always present, so the text is announced; it has no padding while empty. */}
        <p
          aria-live="polite"
          data-testid="search-notice"
          className={cn(
            'text-xs text-muted-foreground',
            notice.session === session &&
              notice.text &&
              'border-t border-border/50 px-4 py-2'
          )}
        >
          {notice.session === session ? notice.text : ''}
        </p>

        {/* Footer */}
        <div
          className={cn(
            'border-t border-border/50 px-4 py-2.5 bg-muted/30 items-center justify-between gap-4 text-xs text-muted-foreground',
            parsedSearch.searchTerm ? 'flex' : 'hidden sm:flex'
          )}
        >
          {/* Key hints are for a keyboard; a phone has none. */}
          <div className="hidden sm:flex items-center gap-4 shrink-0">
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
            <div className="flex min-w-0 items-center gap-1.5">
              <Search className="h-3 w-3 shrink-0" />
              <span className="truncate">
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

const PILL_KEYS: Partial<Record<SearchFilter['type'], string>> = {
  propertyLabel: 'search.pill.property',
  propertyValue: 'search.pill.value',
  name: 'search.pill.name',
  createdBy: 'search.pill.createdBy',
  parent: 'search.pill.parent',
  created: 'search.pill.created',
  updated: 'search.pill.updated',
}

function PillLabel({ filter }: { filter: SearchFilter }) {
  const t = useTranslations()
  if (filter.problem) return <>{filter.raw}</>
  if (filter.type === 'folder') {
    return <FolderPill id={filter.value} />
  }
  if (filter.type === 'deleted') {
    return <>{t(`search.pill.deleted.${filter.value}`)}</>
  }
  const key = PILL_KEYS[filter.type]
  const value =
    filter.type === 'created' || filter.type === 'updated'
      ? filter.value
      : (filter.propertyKey ?? filter.propertyValue ?? filter.value)
  return <>{key ? t(key, { value }) : filter.label}</>
}

/** The folder of an `in:` token by name; the token itself keeps only the id. */
function FolderPill({ id }: { id: string }) {
  const t = useTranslations()
  const { data, isError } = useObjects().useGet(id, { enrichFiles: false })
  if (isError) return <>{t('search.pill.folderMissing')}</>
  return <>{t('search.pill.folder', { name: data?.name ?? id.slice(0, 8) })}</>
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
