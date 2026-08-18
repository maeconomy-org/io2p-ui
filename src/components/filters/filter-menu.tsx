'use client'

import { useTranslations } from 'next-intl'
import { Check, SlidersHorizontal } from 'lucide-react'

import {
  Badge,
  Button,
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@/components/ui'
import { cn } from '@/lib/utils'

/** `undefined` = both tiers; `true` = built-in only; `false` = user-created only. */
export type OwnerFilterValue = boolean | undefined

export interface FilterOption {
  value: string
  label: string
}

export interface FilterSection {
  /** Stable id; also the group's React key. */
  key: string
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  /**
   * At most one option may be selected. Picking a second replaces the first, and picking the current
   * one clears it — for a filter whose options are mutually exclusive (a type is one or the other).
   */
  single?: boolean
  /**
   * A word for the section's CURRENT state, shown on the trigger even when nothing is selected.
   *
   * For a filter whose unselected state is itself meaningful: access defaults to showing everyone's
   * items, and a user who never opens this menu has no way to learn that. The badge cannot say it —
   * counting the default as active would put a permanent `1` on every list.
   */
  summary?: string
  /**
   * Whether this section counts toward the trigger's badge, when membership alone is the wrong
   * test. A section with a stored default is always "selected" — what matters is whether the
   * selection differs from where the list opens for this account.
   */
  activeWhen?: boolean
}

/**
 * Every filter for a list, in one dropdown.
 *
 * One control regardless of how many filters exist, because the alternative does not scale: a row of
 * sibling dropdowns grows a button per filter and wraps before it gets interesting. It also fixes a
 * naming problem it inherited — the deleted toggle was already labelled "Filters" while type and
 * owner sat outside it, which read as though those were something else.
 *
 * Sections are descriptors, so a page adds a filter by adding an entry rather than by finding
 * somewhere in the row to put a button.
 */
export function FilterMenu({
  sections,
  className,
  'data-tour': dataTour,
}: {
  sections: FilterSection[]
  className?: string
  'data-tour'?: string
}) {
  const t = useTranslations()

  const activeCount = sections.reduce(
    (n, s) =>
      n +
      (s.activeWhen === undefined ? s.selected.length : s.activeWhen ? 1 : 0),
    0
  )
  const hasActive = activeCount > 0
  const summaries = sections
    .map((s) => s.summary)
    .filter((v): v is string => !!v)

  const toggle = (section: FilterSection, value: string) => {
    const selected = new Set(section.selected)

    if (section.single) {
      // Re-picking the active option clears it, which is how these read: the filter is off.
      section.onChange(selected.has(value) ? [] : [value])
      return
    }

    if (selected.has(value)) selected.delete(value)
    else selected.add(value)
    section.onChange([...selected])
  }

  const clearAll = () => sections.forEach((s) => s.onChange([]))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="filter-menu"
          data-tour={dataTour}
          className={cn(
            'h-8 border-dashed',
            hasActive && 'border-solid',
            className
          )}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t('common.filters')}
          {summaries.length > 0 && (
            <span
              className="ml-1.5 text-muted-foreground"
              data-testid="filter-summary"
            >
              {summaries.join(' · ')}
            </span>
          )}
          {hasActive && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal tabular-nums"
              >
                {activeCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[15rem] p-0" align="end">
        <Command>
          <CommandList className="max-h-[24rem]">
            {sections.map((section, index) => (
              <div key={section.key}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={section.label}>
                  {section.options.map((option) => {
                    const isSelected = section.selected.includes(option.value)
                    return (
                      <CommandItem
                        key={option.value}
                        data-testid={`filter-option-${option.value}`}
                        data-selected-state={isSelected ? 'on' : 'off'}
                        onSelect={() => toggle(section, option.value)}
                        className="cursor-pointer"
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
                        {option.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </div>
            ))}

            {hasActive && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    data-testid="filter-clear"
                    onSelect={clearAll}
                    className="cursor-pointer justify-center text-center"
                  >
                    {t('common.clearFilters')}
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

/**
 * Section builders take `t` rather than calling `useTranslations` themselves.
 *
 * They are plain functions on purpose: a `use*` name makes them hooks, and a hook cannot be called
 * inside the conditional JSX these are naturally written in (`{isTable && <FilterMenu …>}`). Passing
 * `t` costs one argument and removes the hazard entirely.
 */
type Translate = (key: string) => string

/**
 * The soft-delete section, which every list has.
 *
 * A single "Show deleted" checkbox rather than an exclude/include/only tri-state: the third state is
 * rarely wanted and the node's default (exclude) already covers the common case.
 */
export function deletedSection(
  t: Translate,
  showDeleted: boolean,
  onChange: (show: boolean) => void
): FilterSection {
  return {
    key: 'status',
    label: t('common.status'),
    options: [{ value: 'deleted', label: t('objects.showDeleted') }],
    selected: showDeleted ? ['deleted'] : [],
    onChange: (values) => onChange(values.includes('deleted')),
  }
}

/** The access slice a list asks for. `all` is what every page sends today. */
export type ScopeFilterValue = 'mine' | 'shared' | 'public' | 'all'

const SCOPE_LABELS: Record<ScopeFilterValue, string> = {
  all: 'common.scopeAll',
  mine: 'common.scopeMine',
  shared: 'common.scopeShared',
  public: 'common.scopePublic',
}

/**
 * Whose items the list shows — the access scope.
 *
 * Every list already sends a scope, so anything shared with you is in the table whether or not you
 * asked; the filter lets you separate the slices, and the trigger names the active one because a
 * default nobody can see is one nobody can learn to change.
 *
 * `all` is a real option, not the absence of one. Modelled as absence it had no way back except
 * "Clear filters", which also cleared Status — and it could not be shown selected, so the section
 * read as though nothing was chosen.
 *
 * `storedDefault` is what the badge measures against: it counts having WANDERED from where this
 * list opens for you, not having a value at all. Otherwise every account carries a permanent `1`.
 */
export function scopeSection(
  t: Translate,
  value: ScopeFilterValue,
  onChange: (next: ScopeFilterValue) => void,
  storedDefault: ScopeFilterValue = 'all'
): FilterSection {
  return {
    key: 'scope',
    label: t('common.access'),
    options: [
      { value: 'all', label: t('common.scopeAll') },
      { value: 'mine', label: t('common.scopeMine') },
      { value: 'shared', label: t('common.scopeShared') },
      { value: 'public', label: t('common.scopePublic') },
    ],
    selected: [value],
    summary: t(SCOPE_LABELS[value]),
    // Re-picking the active option would clear it, and this filter has no empty state — the list
    // always asks for some slice. Falling back to the stored default keeps that true.
    onChange: (values) =>
      onChange((values[0] as ScopeFilterValue) ?? storedDefault),
    single: true,
    activeWhen: value !== storedDefault,
  }
}

/**
 * Built-in vs user-created, for the library resources that carry a `system` flag.
 *
 * `single` because the two are exclusive server-side: `?system=` takes one value, and selecting both
 * would have to collapse to "no filter" anyway.
 */
export function ownerSection(
  t: Translate,
  value: OwnerFilterValue,
  onChange: (next: OwnerFilterValue) => void
): FilterSection {
  return {
    key: 'owner',
    label: t('common.tier'),
    options: [
      { value: 'system', label: t('common.builtIn') },
      { value: 'user', label: t('common.userCreated') },
    ],
    selected: value === true ? ['system'] : value === false ? ['user'] : [],
    onChange: (values) =>
      onChange(values.length === 0 ? undefined : values[0] === 'system'),
    single: true,
  }
}
