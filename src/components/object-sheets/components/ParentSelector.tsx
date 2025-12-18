'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ChevronsUpDown, Users, Check } from 'lucide-react'

import { logger } from '@/lib'
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
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCommonApi } from '@/hooks/api'
import type { ParentObject } from '@/types'

interface ParentSelectorProps {
  currentObjectUuid?: string
  initialParentUuids?: string[]
  onParentsChange: (parentUuids: string[]) => void
  placeholder?: string
  maxSelections?: number
  disabled?: boolean
}

export function ParentSelector({
  currentObjectUuid,
  initialParentUuids = [],
  onParentsChange,
  placeholder = 'Search for parent objects...',
  maxSelections = 10,
  disabled = false,
}: ParentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [totalResultsCount, setTotalResultsCount] = useState<number>(0)
  const [isSearching, setIsSearching] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [selectedParents, setSelectedParents] = useState<ParentObject[]>([])

  // Initialize selected parents from UUIDs
  useEffect(() => {
    if (!isOpen) return

    const parentObjects = initialParentUuids.map((uuid) => ({
      uuid,
      name: undefined, // Will be enriched from search results
    }))
    setSelectedParents(parentObjects)
  }, [initialParentUuids])

  // Use the global search API
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()

  // Unified search function
  const performSearch = async (query: string = '') => {
    if (!isOpen) return

    setIsSearching(true)
    try {
      const results = await searchMutation.mutateAsync({
        searchBy: {
          isTemplate: false,
          softDeleted: false,
        },
        ...(query && { searchTerm: query.trim() }),
        size: 8,
        page: 0,
      })

      if (results && results.content) {
        const allFilteredResults = results.content.filter(
          (obj: any) => obj.uuid !== currentObjectUuid
        )

        setSearchResults(allFilteredResults)
        setTotalResultsCount(results.totalElements || allFilteredResults.length)
        setHasInitiallyLoaded(true)
      } else {
        setSearchResults([])
        setTotalResultsCount(0)
        setHasInitiallyLoaded(true)
      }
    } catch (error) {
      logger.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search logic (debounced)
  useEffect(() => {
    if (!isOpen) return
    const timeoutId = setTimeout(() => {
      if (!searchQuery || searchQuery.length < 2) {
        if (!hasInitiallyLoaded || (hasInitiallyLoaded && searchQuery === '')) {
          performSearch()
        }
      } else {
        performSearch(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isOpen])

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Parent Objects</Label>
        {selectedParents.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAllParents}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedParents.length > 0 ? (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="truncate">
                  {selectedParents.length === 1
                    ? '1 parent selected'
                    : `${selectedParents.length} parents selected`}
                </span>
                {selectedParents.length >= maxSelections && (
                  <Badge variant="secondary" className="text-xs">
                    Max
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput
                placeholder="Search parent objects..."
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
            <CommandList className="max-h-[300px] !overflow-y-auto overflow-x-hidden">
              <CommandEmpty>
                {isSearching
                  ? 'Searching...'
                  : searchQuery.length < 2 && searchResults.length === 0
                    ? 'Start typing to search for objects'
                    : 'No objects found.'}
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
                          'h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="font-medium truncate">
                        {object.name || object.uuid}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {searchResults.length > 0 &&
                totalResultsCount > searchResults.length && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-t bg-muted/20">
                    Showing top {searchResults.length} of {totalResultsCount}{' '}
                    result{totalResultsCount !== 1 ? 's' : ''} • Search to find
                    more
                  </div>
                )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Parents Display */}
      {selectedParents.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
          {selectedParents.map((parent, index) => {
            // Try to find the name from search results, fallback to stored name or UUID
            const searchResult = searchResults.find(
              (obj) => obj.uuid === parent.uuid
            )
            const displayName =
              searchResult?.name ||
              parent.name ||
              `${parent.uuid.slice(0, 8)}...`

            return (
              <Badge
                key={`${parent.uuid}-${index}`}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
                title={parent.uuid} // Show full UUID on hover
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

      {/* Max selections reached message */}
      {selectedParents.length >= maxSelections && !disabled && (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxSelections} parent objects allowed
        </p>
      )}
    </div>
  )
}
