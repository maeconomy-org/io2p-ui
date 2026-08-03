'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'

import {
  Badge,
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
import { useObjects, useProcesses } from '@/hooks/api/entities'

const SEARCH_SIZE = 8

/** What a Share can bundle. Objects and processes only — the node rejects anything else. */
export interface ShareResource {
  type: 'object' | 'process'
  id: string
  name: string
}

/**
 * Pick objects AND processes into one list.
 *
 * `ObjectPicker` is single-select and objects-only, so it cannot serve this: a Share bundles both
 * kinds and any number of them. Both lists are searched with the same term and merged, with the
 * type badge carrying the distinction — a single list the user scans is better than two pickers
 * they have to choose between before they have typed anything.
 */
export function ResourcePicker({
  selectedIds,
  onAdd,
}: {
  /** Already in the bundle — offering these again would read as a duplicate. */
  selectedIds: Set<string>
  onAdd: (resource: ShareResource) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const search = { q: query.trim() || undefined, size: SEARCH_SIZE, page: 1 }
  const { data: objects, isFetching: loadingObjects } = useObjects().useList(
    { ...search, scope: 'all' },
    { enabled: open, keepPreviousData: true }
  )
  const { data: processes, isFetching: loadingProcesses } =
    useProcesses().useList(
      { ...search, scope: 'all' },
      { enabled: open, keepPreviousData: true }
    )

  const options: ShareResource[] = [
    ...(objects?.data ?? []).map((o) => ({
      type: 'object' as const,
      id: o.id,
      name: o.name,
    })),
    ...(processes?.data ?? []).map((p) => ({
      type: 'process' as const,
      id: p.id,
      name: p.name,
    })),
  ].filter((r) => !selectedIds.has(r.id))

  const loading = loadingObjects || loadingProcesses

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {t('shares.addResources')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        {/* The server filtered both lists; letting cmdk filter again would drop rows it matched on
            a field cmdk cannot see. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('shares.searchResources')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? t('common.loading') : t('shares.noResources')}
            </CommandEmpty>
            <CommandGroup>
              {options.map((resource) => (
                <CommandItem
                  key={resource.id}
                  value={resource.id}
                  className="cursor-pointer"
                  onSelect={() => {
                    setOpen(false)
                    setQuery('')
                    onAdd(resource)
                  }}
                >
                  <Badge variant={resource.type} className="mr-2 h-5 shrink-0">
                    {t(`shares.resourceType.${resource.type}`)}
                  </Badge>
                  <span className="truncate">{resource.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
