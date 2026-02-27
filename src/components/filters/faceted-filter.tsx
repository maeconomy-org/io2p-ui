'use client'

import * as React from 'react'
import { Check, PlusCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Separator,
} from '@/components/ui'

export interface FacetedFilterOption<T = string> {
  value: T
  label: string
  icon?: React.ReactNode
  count?: number
}

interface FacetedFilterProps<T = string> {
  title: string
  options: FacetedFilterOption<T>[]
  selected: T[]
  onSelectionChange: (values: T[]) => void
  searchPlaceholder?: string
  emptyMessage?: string
  clearLabel?: string
  className?: string
  align?: 'start' | 'center' | 'end'
  showSearch?: boolean
}

/**
 * Faceted filter component following shadcn data-table pattern.
 * Features:
 * - Dashed border trigger button
 * - Badge showing selected count (dot indicator)
 * - Checkboxes with optional icons
 * - Clear filters option at bottom
 */
export function FacetedFilter<T extends string | number = string>({
  title,
  options,
  selected,
  onSelectionChange,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  clearLabel = 'Clear filters',
  className,
  align = 'start',
  showSearch = true,
}: FacetedFilterProps<T>) {
  const selectedSet = new Set(selected)
  const hasSelection = selected.length > 0

  const handleSelect = (value: T) => {
    const newSet = new Set(selectedSet)
    if (newSet.has(value)) {
      newSet.delete(value)
    } else {
      newSet.add(value)
    }
    onSelectionChange(Array.from(newSet))
  }

  const handleClear = () => {
    onSelectionChange([])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            hasSelection && 'border-solid',
            className
          )}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {hasSelection && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selected.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selected.length > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selected.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedSet.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={String(option.value)}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align={align}>
        <Command>
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <CommandItem
                    key={String(option.value)}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    {option.icon && <span className="mr-2">{option.icon}</span>}
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {hasSelection && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleClear}
                    className="justify-center text-center"
                  >
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
