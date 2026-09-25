'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import type { TemplateDTO } from 'io2p-client'

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
import { useTemplates } from '@/hooks/api/entities'
import type { TemplatePresetProperty } from '@/lib/entity'
import { cn } from '@/lib/utils'

/** A flow preset on a process template. `ref` is a SUGGESTED default — often absent. */
export interface TemplatePresetFlow {
  ref?: string
  properties?: TemplatePresetProperty[]
}

const SEARCH_SIZE = 8

export interface TemplateChoice {
  id: string
  name: string
  description?: string
  /**
   * The full preset, not just the keys. A template value carries `ref` and `calc` as well as `data` —
   * its formula recipe, and the ref that recipe binds to. Typing these as `{data}` alone is what made
   * the create form silently drop every formula a template held.
   */
  properties?: TemplatePresetProperty[]
  /** Process templates only — the flow shape to scaffold. */
  inputs?: TemplatePresetFlow[]
  outputs?: TemplatePresetFlow[]
}

/**
 * Pick a template to start an object or process from.
 *
 * **`full: true` is load-bearing, not an optimisation.** A templates list row is LEAN — it carries
 * identity and attributes, and drops `properties` along with a process template's `inputs`/`outputs`
 * presets entirely. Without the flag every pick prefills the NAME and nothing else, silently: the
 * presets are simply absent, so there is no error to see and the form looks like an empty create.
 * Eight rows is the whole page, so asking for their presets costs one request either way.
 */
export function TemplateSelector({
  onSelect,
  selected,
  type = 'object',
}: {
  onSelect: (template: TemplateChoice | null) => void
  selected: TemplateChoice | null
  /**
   * Which kind to offer. Filtered server-side — without it an object create would list process
   * templates, whose properties would apply while their flows silently would not.
   */
  type?: 'object' | 'process'
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data, isFetching } = useTemplates().useList(
    {
      q: query.trim() || undefined,
      size: SEARCH_SIZE,
      page: 1,
      type,
      full: true,
    },
    { enabled: open, keepPreviousData: true }
  )

  // `list()` is typed `Page<TemplateListItem>` whatever the query says, so the flag above cannot show
  // up in the type. The API documents a `full: true` row as matching `TemplateDTO`, and that is the
  // only thing making this assertion true — the two must be changed together.
  const templates = (data?.data ?? []) as TemplateDTO[]

  const choose = (template: TemplateChoice) => {
    onSelect(selected?.id === template.id ? null : template)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="template-selector"
          className={cn(
            'h-9 w-full justify-between font-normal',
            !selected && 'text-muted-foreground'
          )}
        >
          <span className="truncate">
            {selected?.name ?? t('objects.templateSelector.placeholder')}
          </span>
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
            placeholder={t('objects.templateSelector.search')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && templates.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {t('objects.templateSelector.noResults')}
              </CommandEmpty>
            )}
            <CommandGroup>
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  value={template.id}
                  data-testid={`template-option-${template.id}`}
                  onSelect={() => choose(template)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected?.id === template.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {template.name}
                  </span>
                  <OwnerHint
                    system={template.system}
                    ownerUserId={template.ownerUserId}
                    ownerName={template.ownerName}
                  />
                  {(template.properties?.length ?? 0) > 0 && (
                    <span
                      data-testid="template-option-property-count"
                      className="ml-2 shrink-0 text-xs text-muted-foreground"
                    >
                      {t('objects.templateSelector.propertyCount', {
                        count: template.properties?.length ?? 0,
                      })}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
