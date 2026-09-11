'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2, ChevronsUpDown, Users, Check, Plus } from 'lucide-react'

import { logger } from '@/lib/observability/logger'
import {
  Button,
  Badge,
  Label,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui'
import { OwnerHint } from '@/components/entity-list'
import { cn, truncateText } from '@/lib/utils'
import { useIomClient } from '@/lib/io2p'
import type { ParentObject } from '@/types'

const EMPTY_PARENT_UUIDS: string[] = []

interface ParentSelectorProps {
  currentObjectUuid?: string
  /**
   * Objects that must never be offered as a destination.
   *
   * Filtered HERE rather than rejected by the caller afterwards: this picker
   * owns `editedParents` and commits its own state before notifying, so a
   * caller that filters the value cannot make the picker stop showing it — the
   * rejected object stayed selected and badged while the copy silently went to
   * the root.
   */
  excludeUuids?: readonly string[]
  initialParentUuids?: string[]
  onParentsChange: (parentUuids: string[]) => void
  placeholder?: string
  maxSelections?: number
  disabled?: boolean
  /** Compact mode for toolbar usage - hides label and selected parents display */
  compact?: boolean
  /** Custom trigger content for compact mode */
  triggerContent?: React.ReactNode
  /**
   * When true (default), the popover shows a "+ Create new parent" action that
   * fires `onCreateInline`. The host sheet handles opening a nested
   * ObjectAddSheet. Nested sheets pass `false` to enforce the depth=1 invariant.
   */
  allowInlineCreate?: boolean
  /** Fires when the user clicks "+ Create new parent". */
  onCreateInline?: () => void
}

export function ParentSelector({
  currentObjectUuid,
  excludeUuids,
  initialParentUuids = EMPTY_PARENT_UUIDS,
  onParentsChange,
  placeholder,
  maxSelections = 10,
  disabled = false,
  compact = false,
  triggerContent,
  allowInlineCreate = true,
  onCreateInline,
}: ParentSelectorProps) {
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  // Memoised: it is a dependency of the search callback, and a fresh Set each
  // render would rebuild that callback and re-run the search on every keystroke.
  const excludedSet = useMemo(() => new Set(excludeUuids ?? []), [excludeUuids])
  // `null` = untouched, so the incoming uuids show through. Syncing them into state with an effect
  // meant one render with the OLD selection after the prop changed, and setState in an effect body
  // is what the compiler lint rejects.
  const [editedParents, setEditedParents] = useState<ParentObject[] | null>(
    null
  )
  const selectedParents =
    editedParents ??
    initialParentUuids.map((uuid) => ({ uuid, name: undefined }))
  const setSelectedParents = setEditedParents
  const lastSearchQueryRef = useRef('')

  // `useIomClient()` is stable, so the search callback closes over it directly. The ref this
  // replaced existed to hold a per-render mutation object, and writing it during render is exactly
  // what the compiler lint rejects.
  const client = useIomClient()

  // Unified search function
  const performSearch = useCallback(
    async (query: string = '') => {
      if (!isOpen) return

      setIsSearching(true)
      try {
        // `q` substring-matches name and description; `deleted` excludes by default, so the
        // retired `softDeleted: false` filter is implicit.
        const results = await client.objects.list({
          q: query.trim() || undefined,
          size: query ? 20 : 10,
          page: 1,
          scope: 'all',
        })

        // The list speaks `id`; this picker's markup speaks `uuid`.
        setSearchResults(
          results.data
            .filter((o) => o.id !== currentObjectUuid && !excludedSet.has(o.id))
            .map((o) => ({ ...o, uuid: o.id }))
        )
        setHasInitiallyLoaded(true)
      } catch (error) {
        logger.error('Search failed:', { err: error })
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [isOpen, currentObjectUuid, excludedSet, client]
  )

  // Handle search logic (debounced)
  useEffect(() => {
    if (!isOpen) return
    const timeoutId = setTimeout(() => {
      const isClearingSearch =
        lastSearchQueryRef.current.length >= 2 && searchQuery.length < 2

      if (!searchQuery || searchQuery.length < 2) {
        if (!hasInitiallyLoaded || isClearingSearch) {
          performSearch()
        }
      } else {
        performSearch(searchQuery)
      }

      lastSearchQueryRef.current = searchQuery
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isOpen, hasInitiallyLoaded, performSearch])

  const handleSelectParent = (object: any) => {
    // Check if already selected
    const isAlreadySelected = selectedParents.some(
      (parent) => parent.uuid === object.uuid
    )

    let newSelectedParents: ParentObject[]

    if (isAlreadySelected) {
      // Remove if already selected
      newSelectedParents = selectedParents.filter((p) => p.uuid !== object.uuid)
    } else {
      // Add if not selected and under limit
      if (selectedParents.length >= maxSelections) {
        return
      }

      const newParent: ParentObject = {
        uuid: object.uuid,
        name: object.name, // Store name for display
      }

      newSelectedParents = [...selectedParents, newParent]
    }

    setSelectedParents(newSelectedParents)
    onParentsChange(newSelectedParents.map((p) => p.uuid))
  }

  const handleRemoveParent = (parentUuid: string) => {
    const newSelectedParents = selectedParents.filter(
      (p) => p.uuid !== parentUuid
    )
    setSelectedParents(newSelectedParents)
    onParentsChange(newSelectedParents.map((p) => p.uuid))
  }

  const handleClearAllParents = () => {
    setSelectedParents([])
    onParentsChange([])
    setIsOpen(false)
  }

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {!compact && (
        <div className="flex items-center justify-between">
          <Label>{t('objects.parentSelector.label')}</Label>
          {selectedParents.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAllParents}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('objects.parentSelector.clearAll')}
            </Button>
          )}
        </div>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          {triggerContent ? (
            triggerContent
          ) : (
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="parent-selector-listbox"
              className={cn('justify-between', compact ? 'h-8' : 'w-full')}
              disabled={disabled}
            >
              {selectedParents.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="truncate">
                    {compact
                      ? selectedParents.length.toString()
                      : t('objects.parentSelector.selectedCount', {
                          count: selectedParents.length,
                        })}
                  </span>
                  {!compact && selectedParents.length >= maxSelections && (
                    <Badge variant="secondary" className="text-xs">
                      {t('objects.parentSelector.maxBadge')}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {placeholder ?? t('objects.parentSelector.placeholder')}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'p-0',
            compact
              ? 'w-[320px]'
              : 'w-[--radix-popover-trigger-width] min-w-[280px]'
          )}
          align="start"
        >
          <Command shouldFilter={false} id="parent-selector-listbox">
            <div className="relative">
              <CommandInput
                placeholder={t('objects.parentSelector.searchPlaceholder')}
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="ml-2"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <CommandList className="max-h-[300px] overflow-y-auto">
              {allowInlineCreate && !disabled && (
                <>
                  <CommandGroup className="sticky top-0 z-10 bg-popover">
                    <CommandItem
                      value="__create_new_parent__"
                      onSelect={() => {
                        setIsOpen(false)
                        onCreateInline?.()
                      }}
                      className="cursor-pointer flex items-center gap-2 text-primary aria-selected:bg-primary/10"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="font-medium">
                        {t('objects.parentSelector.createNew')}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandEmpty>
                {isSearching
                  ? t('objects.parentSelector.searching')
                  : searchQuery.length < 2 && searchResults.length === 0
                    ? t('objects.parentSelector.startTyping')
                    : t('objects.parentSelector.noResults')}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((object: any) => {
                  const isSelected = selectedParents.some(
                    (parent) => parent.uuid === object.uuid
                  )
                  return (
                    <CommandItem
                      key={object.uuid}
                      value={object.uuid}
                      onSelect={() => handleSelectParent(object)}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          {object.name || object.uuid}
                          <OwnerHint
                            ownerUserId={object.createdBy}
                            ownerName={object.createdByName}
                          />
                        </span>
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {truncateText(object.uuid, 30, true)}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Parents Display - hidden in compact mode */}
      {!compact && selectedParents.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
          {selectedParents.map((parent) => {
            const searchResult = searchResults.find(
              (obj) => obj.uuid === parent.uuid
            )
            const displayName =
              searchResult?.name ||
              parent.name ||
              `${parent.uuid.slice(0, 8)}...`

            return (
              <Badge
                key={parent.uuid}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
                title={parent.uuid}
              >
                <span className="truncate max-w-32">{displayName}</span>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveParent(parent.uuid)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            )
          })}
        </div>
      )}

      {/* Max selections reached message - hidden in compact mode */}
      {!compact && selectedParents.length >= maxSelections && !disabled && (
        <p className="text-xs text-muted-foreground">
          {t('objects.parentSelector.maxSelections', { max: maxSelections })}
        </p>
      )}
    </div>
  )
}
