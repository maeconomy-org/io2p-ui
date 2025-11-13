'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import {
  Button,
  Badge,
  Label,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui'
import { useCommonApi } from '@/hooks/api/useCommonApi'
import type { ParentObject } from '@/types'

interface ParentSelectorProps {
  currentObjectUuid?: string
  selectedParents: ParentObject[]
  onParentsChange: (parents: ParentObject[]) => void
  placeholder?: string
  maxSelections?: number
  disabled?: boolean
}

export function ParentSelector({
  currentObjectUuid,
  selectedParents,
  onParentsChange,
  placeholder = 'Search for parent objects...',
  maxSelections = 10,
  disabled = false,
}: ParentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Use the global search API
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()

  // Execute search when query changes
  useEffect(() => {
    const executeSearch = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const results = await searchMutation.mutateAsync({
          searchTerm: searchQuery.trim(),
          size: 10, // Limit results for better performance
          page: 0,
        })

        if (results && results.content) {
          // Filter out already selected parents
          const filteredResults =
            selectedParents.length > 0
              ? results.content
                  .filter(
                    (obj: any) =>
                      !selectedParents.some(
                        (parent) => parent.uuid === obj.uuid
                      )
                  )
                  .filter((obj: any) => obj.uuid !== currentObjectUuid)
              : results.content

          setSearchResults(filteredResults)
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(executeSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedParents])

  const handleSelectParent = (object: any) => {
    if (selectedParents.length >= maxSelections) {
      return
    }

    const newParent: ParentObject = {
      uuid: object.uuid,
    }

    onParentsChange([...selectedParents, newParent])
    setSearchQuery('')
    setIsOpen(false)
  }

  const handleRemoveParent = (parentUuid: string) => {
    onParentsChange(selectedParents.filter((p) => p.uuid !== parentUuid))
  }

  return (
    <div className="space-y-2">
      <Label>Parent Objects</Label>

      {/* Selected Parents Display */}
      {selectedParents.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
          {selectedParents.map((parent) => (
            <Badge
              key={parent.uuid}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              <span className="truncate max-w-32">{parent.uuid}</span>
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
          ))}
        </div>
      )}

      {/* Add Parent Button/Search */}
      {!disabled && selectedParents.length < maxSelections && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={isSearching}
            >
              <Plus className="h-4 w-4 mr-2" />
              {selectedParents.length === 0
                ? 'Add parent objects'
                : `Add another parent (${selectedParents.length}/${maxSelections})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command shouldFilter={false}>
              <div className="relative">
                <CommandInput
                  placeholder={placeholder}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <CommandEmpty>
                {isSearching
                  ? 'Searching...'
                  : searchQuery.length < 2
                    ? 'Type at least 2 characters to search'
                    : 'No objects found.'}
              </CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-72">
                  {searchResults.map((object: any) => (
                    <CommandItem
                      key={object.uuid}
                      onSelect={() => handleSelectParent(object)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{object.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {object.uuid}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
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
