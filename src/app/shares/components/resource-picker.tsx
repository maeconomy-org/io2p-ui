'use client'

import { type ComponentProps, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDebouncedSearch } from '@/hooks/ui/use-debounced-search'
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
  CommandMore,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import {
  canReshare,
  canWriteLibraryItem,
  OwnerHint,
  permissionOf,
} from '@/components/entity-list'
import { PickerListError } from '@/components/list-error'
import { SearchHighlight, useShownSearch } from '@/components/search-highlight'
import type { Permission, ShareResourceType } from '@/components/access'
import { useAuth } from '@/contexts'
import { useObjects, useProcesses, useTemplates } from '@/hooks/api/entities'
import { useConstants, useFormulas } from '@/hooks/api/leaves'
import { SearchMinHint } from '@/components/search-min-hint'

import { familyOf, type ShareResourceFamily } from '../utils/share-rules'

// Per TYPE, not per list: one list merges two or three types, so a full `SEARCH_SIZE` of each would
// put up to 60 rows on screen before the user types anything.
const PER_TYPE_SIZE = 8

/** What a Share can bundle — all five, since the node stopped narrowing shares to data types. */
export interface ShareResource {
  type: ShareResourceType
  id: string
  name: string
  system?: boolean
  ownerUserId?: string
  ownerName?: string
  /** The viewer's own level on it, where known; it limits the member levels the bundle offers. */
  permission?: Permission
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
  const q = useDebouncedSearch(query, 'words')
  const [browsing, setBrowsing] = useState<ShareResourceFamily>('data')

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
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
        <ResourcePickerContent
          selectedIds={selectedIds}
          family={family}
          browsing={browsing}
          onBrowse={setBrowsing}
          query={query}
          q={q}
          onQueryChange={setQuery}
          onPick={(resource) => {
            setOpen(false)
            setQuery('')
            onAdd(resource)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The family switch, the search and its results. Inside the popover content, which unmounts on
 * close: the list queries then lose their last observer and TanStack aborts a request still open.
 */
function ResourcePickerContent({
  selectedIds,
  family,
  browsing,
  onBrowse,
  query,
  q,
  onQueryChange,
  onPick,
}: {
  selectedIds: Set<string>
  family: ShareResourceFamily | null
  browsing: ShareResourceFamily
  onBrowse: (family: ShareResourceFamily) => void
  query: string
  /** The search, debounced in the parent so its last value outlives a close. */
  q: string | undefined
  onQueryChange: (query: string) => void
  onPick: (resource: ShareResource) => void
}) {
  const t = useTranslations()
  // The lock wins over the browsing choice, so a locked bundle cannot be shown the other family's
  // list at all — not even for a moment before the add is rejected.
  const active = family ?? browsing

  const hintId = useId()
  const search = { q, size: PER_TYPE_SIZE, page: 1 }
  const results = { search, selectedIds, onPick }

  return (
    <>
      <div className="flex gap-1 border-b p-1">
        {(['data', 'library'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={active === option ? 'secondary' : 'ghost'}
            className="h-7 flex-1 text-xs"
            disabled={!!family && family !== option}
            onClick={() => onBrowse(option)}
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
          onValueChange={onQueryChange}
          aria-describedby={hintId}
        />
        <SearchMinHint query={query} kind="words" id={hintId} />
        {/* One family's lists at a time: switching unmounts the other, so its requests abort. */}
        {active === 'data' ? (
          <DataResults {...results} />
        ) : (
          <LibraryResults {...results} />
        )}
      </Command>
    </>
  )
}

type ResultsProps = {
  search: { q?: string; size: number; page: number }
  selectedIds: Set<string>
  onPick: (resource: ShareResource) => void
}

function DataResults({ search, selectedIds, onPick }: ResultsProps) {
  const { userId } = useAuth()
  const listOptions = { keepPreviousData: true }
  const {
    data: objects,
    isFetching: loadingObjects,
    isPlaceholderData: oldObjects,
    error: objectsError,
  } = useObjects().useList({ ...search, scope: 'all' }, listOptions)
  const {
    data: processes,
    isFetching: loadingProcesses,
    isPlaceholderData: oldProcesses,
    error: processesError,
  } = useProcesses().useList({ ...search, scope: 'all' }, listOptions)

  const options: ShareResource[] = [
    ...(objects?.data ?? []).map((o) => ({
      type: 'object' as const,
      id: o.id,
      name: o.name,
      ownerUserId: o.createdBy,
      ownerName: o.createdByName,
      permission: permissionOf(o, userId),
    })),
    ...(processes?.data ?? []).map((p) => ({
      type: 'process' as const,
      id: p.id,
      name: p.name,
      ownerUserId: p.createdBy,
      ownerName: p.createdByName,
      permission: permissionOf(p, userId),
    })),
  ]
  const dataSearch = useShownSearch(search.q, oldObjects || oldProcesses)
  return (
    <ResourceResults
      highlight={dataSearch}
      error={objectsError ?? processesError ?? null}
      options={options.filter((r) => !selectedIds.has(r.id))}
      loading={loadingObjects || loadingProcesses}
      pages={[objects, processes]}
      onPick={onPick}
    />
  )
}

function LibraryResults({ search, selectedIds, onPick }: ResultsProps) {
  const listOptions = { keepPreviousData: true }
  const {
    data: formulas,
    isFetching: loadingFormulas,
    isPlaceholderData: oldFormulas,
    error: formulasError,
  } = useFormulas().useList(search, listOptions)
  const {
    data: constants,
    isFetching: loadingConstants,
    isPlaceholderData: oldConstants,
    error: constantsError,
  } = useConstants().useList(search, listOptions)
  const {
    data: templates,
    isFetching: loadingTemplates,
    isPlaceholderData: oldTemplates,
    error: templatesError,
  } = useTemplates().useList(search, listOptions)

  const options: ShareResource[] = [
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
  const librarySearch = useShownSearch(
    search.q,
    oldFormulas || oldConstants || oldTemplates
  )
  return (
    <ResourceResults
      highlight={librarySearch}
      error={formulasError ?? constantsError ?? templatesError ?? null}
      options={options.filter((r) => !selectedIds.has(r.id))}
      loading={loadingFormulas || loadingConstants || loadingTemplates}
      pages={[formulas, constants, templates]}
      onPick={onPick}
    />
  )
}

function ResourceResults({
  highlight,
  error,
  options,
  loading,
  pages,
  onPick,
}: {
  highlight: string | undefined
  error: unknown
  options: ShareResource[]
  loading: boolean
  pages: ComponentProps<typeof CommandMore>['pages']
  onPick: (resource: ShareResource) => void
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  // Objects and processes carry the viewer's level. A library item is shared read-only and only by
  // its owner, so ownership is the whole answer there (a built-in item has no user owner).
  const refusal = (resource: ShareResource): string | null => {
    if (familyOf(resource.type) === 'library') {
      return canWriteLibraryItem(resource, userId)
        ? null
        : 'shares.ownerOnlyShare'
    }
    return canReshare(resource.permission) ? null : 'shares.needsShareAccess'
  }

  return (
    <>
      <PickerListError error={error} />
      <CommandList>
        {error == null && (
          <CommandEmpty>
            {loading ? t('common.loading') : t('shares.noResources')}
          </CommandEmpty>
        )}
        <CommandGroup>
          {options.map((resource) => (
            <CommandItem
              key={resource.id}
              value={resource.id}
              data-testid={`resource-option-${resource.id}`}
              className="cursor-pointer"
              // The node refuses the whole bundle for a resource the viewer cannot share.
              disabled={!!refusal(resource)}
              onSelect={() => onPick(resource)}
            >
              <Badge variant={resource.type} className="mr-2 h-5 shrink-0">
                {t(`shares.resourceType.${resource.type}`)}
              </Badge>
              <span className="truncate">
                <SearchHighlight text={resource.name} q={highlight} />
              </span>
              <OwnerHint
                system={resource.system}
                ownerUserId={resource.ownerUserId}
                ownerName={resource.ownerName}
              />
              {refusal(resource) && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {t(refusal(resource)!)}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <CommandMore pages={pages} capped />
    </>
  )
}
