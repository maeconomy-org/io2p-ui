'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, FileText, Loader2 } from 'lucide-react'

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  FormLabel,
} from '@/components/ui'
import { logger, cn } from '@/lib'
import { useCommonApi } from '@/hooks/api'

export interface ModelOption {
  uuid: string
  name: string
  abbreviation?: string
  version?: string
  description?: string
  properties?: any[]
}

interface ModelSelectorProps {
  selectedModel?: ModelOption | null
  onModelSelect: (model: ModelOption | null) => void
  placeholder?: string
  disabled?: boolean
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  placeholder = 'Select a model template...',
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [totalResultsCount, setTotalResultsCount] = useState<number>(0)
  const [isSearching, setIsSearching] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  // Use the global search API
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()

  // Unified search function
  const performSearch = async (query: string = '') => {
    if (!open) return

    setIsSearching(true)
    try {
      const results = await searchMutation.mutateAsync({
        searchBy: {
          isTemplate: true,
          softDeleted: false,
        },
        ...(query && { searchTerm: query.trim() }),
        size: 8,
        page: 0,
      })

      if (results && results.content) {
        const modelOptions: ModelOption[] = results.content.map(
          (model: any) => ({
            uuid: model.uuid,
            name: model.name,
            abbreviation: model.abbreviation,
            version: model.version,
            description: model.description,
            properties: model.properties || [],
          })
        )

        setModels(modelOptions)
        setTotalResultsCount(results.totalElements || modelOptions.length)
        setHasInitiallyLoaded(true)
      } else {
        setModels([])
        setTotalResultsCount(0)
        setHasInitiallyLoaded(true)
      }
    } catch (error) {
      logger.error('Model search failed:', error)
      setModels([])
      setTotalResultsCount(0)
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search logic (debounced)
  useEffect(() => {
    if (!open) return

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
  }, [searchQuery, open])

  const handleModelSelect = (model: ModelOption) => {
    onModelSelect(model)
    setOpen(false)
  }

  const handleClearSelection = () => {
    onModelSelect(null)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FormLabel>Model Template</FormLabel>
        {selectedModel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </Button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedModel ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="truncate">{selectedModel.name}</span>
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
                placeholder="Search models..."
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
                  : searchQuery.length < 2 && models.length === 0
                    ? 'Start typing to search for models'
                    : 'No models found.'}
              </CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.uuid}
                    value={model.uuid}
                    onSelect={() => handleModelSelect(model)}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        selectedModel?.uuid === model.uuid
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {model.name}
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {models.length > 0 && totalResultsCount > models.length && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t bg-muted/20">
                  Showing top {models.length} of {totalResultsCount} result
                  {totalResultsCount !== 1 ? 's' : ''} • Search to find more
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
