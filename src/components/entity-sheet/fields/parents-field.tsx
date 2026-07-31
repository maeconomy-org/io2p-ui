'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

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
import { useObjects } from '@/hooks/api/entities'
import { cn } from '@/lib/utils'
import type { EntityDraft } from '@/lib/entity-body'

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
  selfId,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  parentNames: Map<string, string>
  /** The entity being edited, so it can't be offered as its own parent (the server rejects it too). */
  selfId?: string
}) {
  const t = useTranslations()
  const parentIds = form.watch('parentIds')
  // Names for parents picked in this session; the loaded entity only knows the ones it arrived with.
  const [pickedNames, setPickedNames] = useState<Map<string, string>>(new Map())

  const nameOf = (id: string) =>
    parentNames.get(id) ?? pickedNames.get(id) ?? id

  const setParents = (next: string[]) =>
    form.setValue('parentIds', next, { shouldDirty: true })

  const remove = (id: string) => setParents(parentIds.filter((p) => p !== id))

  const toggle = (id: string, name: string) => {
    setPickedNames((m) => new Map(m).set(id, name))
    setParents(
      parentIds.includes(id)
        ? parentIds.filter((p) => p !== id)
        : [...parentIds, id]
    )
  }

  if (!editing && parentIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
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
            <Badge key={id} variant="secondary" className="gap-1">
              {nameOf(id)}
              {editing ? (
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
              ) : (
                // The badge shows a name; the id is what you need to paste elsewhere.
                <CopyButton
                  text={id}
                  label={nameOf(id)}
                  className="h-4 w-4"
                  iconSize="sm"
                />
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
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
