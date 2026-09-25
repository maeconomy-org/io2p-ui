'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CopyButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { OwnerHint } from '@/components/entity-list'
import { useObjects } from '@/hooks/api/entities'
import { cn } from '@/lib/utils'
import type { EntityDraft } from '@/lib/entity'

const SEARCH_SIZE = 8

/**
 * The object's parents. io2p models hierarchy as `parents[]` on the CHILD (a multi-parent DAG), so
 * this edits the entity being created/edited — there is no children field to write from the other
 * side.
 */
export function ParentsField({
  form,
  editing,
  parentNames,
  deletedParentIds,
  onParentPicked,
  selfId,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  parentNames: Map<string, string>
  /**
   * Parents that are soft-deleted. Delete does not cascade, so this object is live while one of its
   * parents is a tombstone — an unmarked chip would read as an ordinary link to an ordinary parent.
   */
  deletedParentIds?: Set<string>
  /**
   * Report a name the picker just resolved. The OWNER holds the map: the loaded entity only knows
   * the parents it arrived with, and the sheet needs a freshly picked name after Save to say where
   * the object went.
   */
  onParentPicked?: (id: string, name: string) => void
  /** The entity being edited, so it can't be offered as its own parent (the server rejects it too). */
  selfId?: string
}) {
  const t = useTranslations()
  // `useWatch`, NOT `form.watch` — this component does not own the `useForm`. Removing a badge
  // changes no local state, so a plain read leaves the removed parent on screen.
  const parentIds = useWatch({ control: form.control, name: 'parentIds' }) ?? []

  const nameOf = (id: string) => parentNames.get(id) ?? id
  const isDeleted = (id: string) => deletedParentIds?.has(id) ?? false

  const setParents = (next: string[]) =>
    form.setValue('parentIds', next, { shouldDirty: true })

  const remove = (id: string) => setParents(parentIds.filter((p) => p !== id))

  const toggle = (id: string, name: string) => {
    onParentPicked?.(id, name)
    setParents(
      parentIds.includes(id)
        ? parentIds.filter((p) => p !== id)
        : [...parentIds, id]
    )
  }

  if (!editing && parentIds.length === 0) {
    return (
      <p data-testid="parents-empty" className="text-sm text-muted-foreground">
        {t('objects.detailsSheet.noParents')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {editing && (
        <ParentPicker
          selectedIds={parentIds}
          selfId={selfId}
          onToggle={toggle}
        />
      )}

      {parentIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {parentIds.map((id) => (
            <Badge
              key={id}
              variant="secondary"
              data-testid={`parent-badge-${id}`}
              className={cn(
                'gap-1',
                isDeleted(id) && 'border-destructive/40 text-destructive'
              )}
            >
              {editing ? (
                <>
                  <span className={cn(isDeleted(id) && 'line-through')}>
                    {nameOf(id)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    aria-label={`${t('common.remove')} ${nameOf(id)}`}
                    onClick={() => remove(id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  {/* A LINK, because `/objects` lists roots only: once this object has a parent it
                      is no longer in that list, and its parent's page is where it now lives. */}
                  <Link
                    href={`/objects/${id}`}
                    data-testid={`parent-link-${id}`}
                    className={cn(
                      'underline-offset-2 hover:underline',
                      isDeleted(id) && 'line-through'
                    )}
                  >
                    {nameOf(id)}
                  </Link>
                  {isDeleted(id) && (
                    <span
                      className="text-[10px]"
                      data-testid={`parent-deleted-${id}`}
                    >
                      {t('objects.deletedBadge')}
                    </span>
                  )}
                  <CopyButton
                    text={id}
                    label={nameOf(id)}
                    className="h-4 w-4"
                    iconSize="sm"
                  />
                </>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ParentPicker({
  selectedIds,
  selfId,
  onToggle,
}: {
  selectedIds: string[]
  selfId?: string
  onToggle: (id: string, name: string) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // `scope` defaults to 'mine', which would hide objects shared with the user.
  const { data, isFetching } = useObjects().useList(
    { q: query.trim() || undefined, size: SEARCH_SIZE, page: 1, scope: 'all' },
    { enabled: open, keepPreviousData: true }
  )

  const results = useMemo(
    () => (data?.data ?? []).filter((o) => o.id !== selfId),
    [data, selfId]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="parent-picker"
          className="h-9 w-full justify-between font-normal text-muted-foreground"
        >
          {t('objects.parentPicker.search')}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* The node filters server-side, so let Command show whatever came back. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('objects.parentPicker.search')}
            data-testid="parent-search"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && results.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>{t('objects.parentPicker.noResults')}</CommandEmpty>
            )}
            <CommandGroup>
              {results.map((object) => (
                <CommandItem
                  key={object.id}
                  value={object.id}
                  data-testid={`parent-option-${object.id}`}
                  onSelect={() => onToggle(object.id, object.name)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedIds.includes(object.id)
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
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
