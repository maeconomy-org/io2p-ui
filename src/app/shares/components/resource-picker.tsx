'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Info, Plus } from 'lucide-react'

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
import { OwnerHint } from '@/components/entity-list'
import type { ShareResourceType } from '@/components/access'
import { useObjects, useProcesses, useTemplates } from '@/hooks/api/entities'
import { useConstants, useFormulas } from '@/hooks/api/leaves'

import type { ShareResourceFamily } from '../utils/share-rules'

const SEARCH_SIZE = 8

/** What a Share can bundle — all five, since the node stopped narrowing shares to data types. */
export interface ShareResource {
  type: ShareResourceType
  id: string
  name: string
  system?: boolean
  ownerUserId?: string
  ownerName?: string
}

/**
 * Pick resources of ONE family into a bundle.
 *
 * The family is a segmented control rather than a filter, because it is a rule and not a
 * preference: it locks to whatever the first pick was and says why. `ObjectPicker` is
 * single-select and objects-only, so it cannot serve this — a bundle takes any number of several
 * kinds, and the type badge carries the distinction inside one merged list the user scans.
 */
export function ResourcePicker({
  selectedIds,
  family,
  onAdd,
}: {
  /** Already in the bundle — offering these again would read as a duplicate. */
  selectedIds: Set<string>
  /** Locked once the bundle is non-empty; null while it is still empty. */
  family: ShareResourceFamily | null
  onAdd: (resource: ShareResource) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [browsing, setBrowsing] = useState<ShareResourceFamily>('data')

  // The lock wins over the browsing choice, so a locked bundle cannot be shown the other family's
  // list at all — not even for a moment before the add is rejected.
  const active = family ?? browsing
  const wantData = open && active === 'data'
  const wantLibrary = open && active === 'library'

  const search = { q: query.trim() || undefined, size: SEARCH_SIZE, page: 1 }
  const listOptions = (enabled: boolean) => ({
    enabled,
    keepPreviousData: true,
  })

  const { data: objects, isFetching: loadingObjects } = useObjects().useList(
    { ...search, scope: 'all' },
    listOptions(wantData)
  )
  const { data: processes, isFetching: loadingProcesses } =
    useProcesses().useList({ ...search, scope: 'all' }, listOptions(wantData))
  const { data: formulas, isFetching: loadingFormulas } = useFormulas().useList(
    search,
    listOptions(wantLibrary)
  )
  const { data: constants, isFetching: loadingConstants } =
    useConstants().useList(search, listOptions(wantLibrary))
  const { data: templates, isFetching: loadingTemplates } =
    useTemplates().useList(search, listOptions(wantLibrary))

  const options: ShareResource[] = (
    active === 'data'
      ? [
          ...(objects?.data ?? []).map((o) => ({
            type: 'object' as const,
            id: o.id,
            name: o.name,
            ownerUserId: o.createdBy,
            ownerName: o.createdByName,
          })),
          ...(processes?.data ?? []).map((p) => ({
            type: 'process' as const,
            id: p.id,
            name: p.name,
            ownerUserId: p.createdBy,
            ownerName: p.createdByName,
          })),
        ]
      : [
          ...(formulas?.data ?? []).map((f) => ({
            type: 'formula' as const,
            id: f.id,
            name: f.name,
            system: f.system,
            ownerUserId: f.ownerUserId,
            ownerName: f.ownerName,
          })),
          ...(constants?.data ?? []).map((c) => ({
            type: 'constant' as const,
            id: c.id,
            name: c.name,
            system: c.system,
            ownerUserId: c.ownerUserId,
            ownerName: c.ownerName,
          })),
          ...(templates?.data ?? []).map((tpl) => ({
            type: 'template' as const,
            id: tpl.id,
            name: tpl.name,
            system: tpl.system,
            ownerUserId: tpl.ownerUserId,
            ownerName: tpl.ownerName,
          })),
        ]
  ).filter((r) => !selectedIds.has(r.id))

  const loading =
    active === 'data'
      ? loadingObjects || loadingProcesses
      : loadingFormulas || loadingConstants || loadingTemplates

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          data-testid="resource-picker"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('shares.addResources')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="flex gap-1 border-b p-1">
          {(['data', 'library'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={active === option ? 'secondary' : 'ghost'}
              className="h-7 flex-1 text-xs"
              disabled={!!family && family !== option}
              onClick={() => setBrowsing(option)}
            >
              {t(`shares.family.${option}`)}
            </Button>
          ))}
        </div>

        {family && (
          <p className="flex items-start gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('shares.familyLocked')}</span>
          </p>
        )}

        {/* The server filtered every list; letting cmdk filter again would drop rows it matched on
            a field cmdk cannot see. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('shares.searchResources')}
            data-testid="resource-search"
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
                  data-testid={`resource-option-${resource.id}`}
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
                  <OwnerHint
                    system={resource.system}
                    ownerUserId={resource.ownerUserId}
                    ownerName={resource.ownerName}
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
