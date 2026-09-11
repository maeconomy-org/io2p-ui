'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronsUpDown, Loader2 } from 'lucide-react'

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
} from '@/components/ui'
import { OwnerHint } from '@/components/entity-list'
import { useObjects } from '@/hooks/api/entities'
import { cn } from '@/lib/utils'

const SEARCH_SIZE = 8

/**
 * Pick ONE existing object. Used by process flows, where the target must already exist — io2p
 * validates a flow `ref` against the registry and additionally requires the caller to be able to READ
 * it, so there is no inline-create path here.
 *
 * `refName` comes from the read model for a saved flow; a freshly picked one only knows what the
 * search returned, so the chosen name is held locally rather than re-fetched.
 */
export function ObjectPicker({
  value,
  displayName,
  onSelect,
  disabled,
  className,
  placeholder,
  testId = 'object-picker',
}: {
  value: string
  /** Resolved name for `value`, when the caller knows one. */
  displayName?: string
  onSelect: (id: string, name: string) => void
  disabled?: boolean
  className?: string
  /** Empty-state label. A template flow's target is optional, so "select" would overstate it. */
  placeholder?: string
  testId?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pickedName, setPickedName] = useState<string | undefined>()

  const { data, isFetching } = useObjects().useList(
    { q: query.trim() || undefined, size: SEARCH_SIZE, page: 1, scope: 'all' },
    { enabled: open, keepPreviousData: true }
  )
  const objects = data?.data ?? []

  // Fall back to the raw id rather than showing an empty control: an unresolved ref is still a real
  // target, and hiding it would read as "nothing selected".
  const label = pickedName ?? displayName ?? value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'h-8 justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {value ? label : (placeholder ?? t('processes.flows.selectObject'))}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* The node filters server-side, so let Command show whatever came back. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('processes.flows.searchObjects')}
            data-testid="object-picker-search"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && objects.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>{t('processes.flows.noObjects')}</CommandEmpty>
            )}
            <CommandGroup>
              {objects.map((object) => (
                <CommandItem
                  key={object.id}
                  value={object.id}
                  data-testid={`object-option-${object.id}`}
                  onSelect={() => {
                    setPickedName(object.name)
                    onSelect(object.id, object.name)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{object.name}</span>
                  <OwnerHint
                    ownerUserId={object.createdBy}
                    ownerName={object.createdByName}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
