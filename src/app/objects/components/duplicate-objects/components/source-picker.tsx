'use client'

import { useId } from 'react'
import {
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandMore,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { OwnerHint } from '@/components/entity-list'
import { PickerListError } from '@/components/list-error'
import { SearchHighlight } from '@/components/search-highlight'
import { SearchMinHint } from '@/components/search-min-hint'
import { isCappedCount, TOTAL_CAP } from '@/lib/list-total'
import { cn } from '@/lib/utils'

import type { DuplicateSourceObject } from '../types'
import type { SourceSearch, SourceSearchRow } from '../use-source-search'

interface SourcePickerProps {
  search: SourceSearch
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedObjects: DuplicateSourceObject[]
  /** Rows not offered: the chosen target parents. */
  excludeUuids: string[]
  disabled: boolean
  onToggle: (row: SourceSearchRow) => void
  onRemove: (uuid: string) => void
}

export function SourcePicker({
  search,
  open,
  onOpenChange,
  selectedObjects,
  excludeUuids,
  disabled,
  onToggle,
  onRemove,
}: SourcePickerProps) {
  const t = useTranslations()
  const hintId = useId()
  const selectedUuids = new Set(selectedObjects.map((o) => o.uuid))

  return (
    <div className="grid gap-2">
      <Label>{t('objects.duplicate.sourceObjects')}</Label>
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls="copy-source-listbox"
            className="w-full justify-between"
            disabled={disabled}
            data-testid="duplicate-source-trigger"
          >
            {selectedObjects.length > 0 ? (
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span className="truncate">
                  {t('objects.duplicate.selectedCount', {
                    count: selectedObjects.length,
                  })}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {t('objects.duplicate.sourceObjectsHint')}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0"
          align="start"
        >
          <Command shouldFilter={false} id="copy-source-listbox">
            <div className="relative">
              <CommandInput
                placeholder={t('objects.duplicate.sourceObjectsHint')}
                value={search.query}
                onValueChange={search.setQuery}
                aria-describedby={hintId}
                className="ml-2"
              />
              {search.isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
                </div>
              )}
            </div>
            <SearchMinHint query={search.query} kind="words" id={hintId} />
            <PickerListError error={search.error} />
            <CommandList className="max-h-[300px] !overflow-y-auto overflow-x-hidden">
              {search.error == null && (
                <CommandEmpty>
                  {search.isSearching
                    ? t('common.loading')
                    : t('objects.parentSelector.noResults')}
                </CommandEmpty>
              )}
              <CommandGroup>
                {search.results
                  .filter((row) => !excludeUuids.includes(row.uuid))
                  .map((row) => (
                    <CommandItem
                      key={row.uuid}
                      value={row.uuid}
                      onSelect={() => onToggle(row)}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          selectedUuids.has(row.uuid)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">
                        <SearchHighlight
                          text={row.name || row.uuid}
                          q={search.resultsSearch}
                        />
                      </span>
                      <OwnerHint
                        ownerUserId={row.createdBy}
                        ownerName={row.createdByName}
                      />
                      {row.childCount !== undefined && row.childCount > 0 && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {isCappedCount(row.childCount)
                            ? t('objects.duplicate.childCountMoreThan', {
                                count: TOTAL_CAP,
                              })
                            : t('objects.duplicate.childCount', {
                                count: row.childCount,
                              })}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
            <CommandMore pages={[search.page]} capped />
          </Command>
        </PopoverContent>
      </Popover>

      {selectedObjects.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/20 rounded-md">
          {selectedObjects.map((obj) => (
            <Badge
              key={obj.uuid}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
              title={obj.uuid}
            >
              <span className="truncate max-w-32">{obj.name}</span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => onRemove(obj.uuid)}
                  aria-label={t('common.remove')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('objects.duplicate.noObjectsSelected')}
        </p>
      )}
    </div>
  )
}
