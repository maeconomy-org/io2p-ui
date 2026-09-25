'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import type { UnitEntry } from 'io2p-client'

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
import { useUnits } from '@/hooks/api/leaves'
import { cn } from '@/lib/utils'

/**
 * Picks the unit a formula DECLARES its result to be in.
 *
 * A closed vocabulary, unlike the property-name field: the node validates the symbol against its
 * table and 422s anything else, so free text would only ever produce a rejected save. That is why
 * this is a picker and not a combobox with a free-text escape.
 *
 * No `shouldFilter={false}`: the whole vocabulary arrives in one response, so cmdk filters it
 * locally and there is no query state to hold. Grouping by dimension is what makes ~40 symbols
 * readable — it also puts `kg` next to `t`, which is where the choice actually gets made.
 */
export function UnitPicker({
  value,
  onChange,
  id,
  className,
}: {
  /** The declared symbol, or empty for none. */
  value: string
  onChange: (unit: string) => void
  id?: string
  className?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const { data: units, isFetching } = useUnits({ enabled: open })

  const byDimension = useMemo(() => groupByDimension(units ?? []), [units])

  const pick = (symbol: string) => {
    onChange(symbol)
    setOpen(false)
  }

  return (
    // `modal`: the sheet around this is a Radix Dialog, which sets `pointer-events: none` on the
    // body while it is open. The popover portals OUTSIDE the sheet's content, so it inherited that
    // and the list could be walked with the arrow keys but not scrolled with a wheel. Modal gives
    // the popover its own interaction layer.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="unit-picker"
          className={cn(
            // h-10 to match `Input`: this sits in the same form column as the name field, and the
            // h-8 the in-sheet pickers use is for the denser property rows.
            'h-10 w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{value || t('formulas.unitNone')}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t('formulas.searchUnits')} />
          {/* Bounded by the space Radix measured between the trigger and the viewport edge, not
              just by CommandList's own 300px: inside a sheet the popover can open with less room
              than that, and the list would then run past the bottom with nothing to scroll. */}
          <CommandList className="max-h-[min(300px,var(--radix-popover-content-available-height))]">
            {isFetching && !units ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>{t('formulas.noUnitMatches')}</CommandEmpty>
            )}

            {/* Clearing a declaration is a real action — without this the first symbol touched
                becomes permanent for the life of the form. */}
            <CommandGroup>
              <CommandItem
                value={t('formulas.unitNone')}
                data-testid="unit-option-none"
                onSelect={() => pick('')}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === '' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {t('formulas.unitNone')}
              </CommandItem>
            </CommandGroup>

            {byDimension.map(([dimension, entries]) => (
              <CommandGroup key={dimension} heading={dimension}>
                {entries.map((unit) => (
                  <CommandItem
                    key={unit.symbol}
                    // Aliases join the searchable text so "tonne" finds `t`, which the node
                    // accepts on input and the symbol alone would hide.
                    value={[unit.symbol, unit.dimension, ...unit.aliases].join(
                      ' '
                    )}
                    data-testid={`unit-option-${unit.symbol}`}
                    onSelect={() => pick(unit.symbol)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === unit.symbol ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono">{unit.symbol}</span>
                    {unit.canonical && (
                      <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t('formulas.unitCanonical')}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Dimensions in first-seen order, canonical unit first within each.
 *
 * The canonical one leads because it is what a value of that dimension is stored in, so it is the
 * declaration that needs no conversion and the one most authors want.
 */
function groupByDimension(units: UnitEntry[]): [string, UnitEntry[]][] {
  const groups = new Map<string, UnitEntry[]>()
  for (const unit of units) {
    groups.set(unit.dimension, [...(groups.get(unit.dimension) ?? []), unit])
  }
  return [...groups.entries()].map(([dimension, entries]) => [
    dimension,
    [...entries].sort((a, b) => Number(b.canonical) - Number(a.canonical)),
  ])
}
