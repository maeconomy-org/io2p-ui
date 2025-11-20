'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, FileText } from 'lucide-react'

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
  Badge,
  ScrollArea,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAggregate } from '@/hooks'

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
  const [models, setModels] = useState<ModelOption[]>([])

  const { useModelEntities } = useAggregate()

  // Only fetch when open and no models loaded yet
  const { data: modelResponse, isLoading: queryLoading } = useModelEntities(
    {
      page: 0,
      size: 100,
      searchBy: { softDeleted: false },
    },
    {
      enabled: open && models.length === 0, // Only fetch when open and no models
      staleTime: 300000, // Cache for 5 minutes
    }
  )

  const isLoading = queryLoading

  useEffect(() => {
    if (modelResponse?.content && open) {
      const modelOptions: ModelOption[] = modelResponse.content.map(
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
    }
  }, [modelResponse, open])

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
          <Command>
            <CommandInput placeholder="Search models..." className="ml-2" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Loading models...' : 'No models found.'}
              </CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.uuid}
                    value={`${model.name} ${model.abbreviation || ''} ${model.version || ''}`}
                    onSelect={() => handleModelSelect(model)}
                    className="flex items-center gap-2"
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
