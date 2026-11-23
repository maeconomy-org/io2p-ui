'use client'

import * as React from 'react'

import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface UnitInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange'
> {
  value: string
  units: readonly { symbol: string; dimension: string }[]
  onValueChange: (value: string) => void
}

const MAX_SHOWN = 8

/**
 * A unit stays typed text: the units table decides what the search accepts, the list only saves
 * typing. A combobox, so the arrows pick a suggestion and Escape closes the list before the panel.
 */
export function UnitInput({
  id,
  value,
  units,
  onValueChange,
  className,
  ...props
}: UnitInputProps) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const listId = `${id}-list`
  const typed = value.trim().toLowerCase()
  const shown = units
    .filter((u) => !typed || u.symbol.toLowerCase().startsWith(typed))
    .slice(0, MAX_SHOWN)
  const visible = open && shown.length > 0 && shown[0].symbol !== value

  const choose = (symbol: string) => {
    onValueChange(symbol)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!visible) {
            if (e.key === 'ArrowDown') setOpen(true)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, shown.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            // Enter picks the suggestion; the next Enter applies the panel.
            e.preventDefault()
            e.stopPropagation()
            choose(shown[active].symbol)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={className}
        {...props}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!visible}
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {shown.map((unit, index) => (
          <li
            key={unit.symbol}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown, not click: the input's blur closes the list before a click lands.
            onMouseDown={(e) => {
              e.preventDefault()
              choose(unit.symbol)
            }}
            onMouseMove={() => setActive(index)}
            className={cn(
              'flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm',
              index === active && 'bg-accent text-accent-foreground'
            )}
          >
            <span>{unit.symbol}</span>
            <span className="text-xs text-muted-foreground">
              {unit.dimension}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
