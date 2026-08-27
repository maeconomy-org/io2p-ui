'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronLeft, ChevronRight, Layers, Package } from 'lucide-react'

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
import { cn } from '@/lib/utils'

import type { GraphNode } from '../utils/process-graph'

export interface ProcessFlowToolbarProps {
  depthLimited: boolean
  onDepthLimitedChange: (limited: boolean) => void
  windowFrom: number
  windowTo: number
  totalLevels: number
  windowSize: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  hiddenNodeCount: number
  /** Disabled while a focus is active — focus is its own slice, not a depth window. */
  depthDisabled: boolean
  /** Depth slicing and unit scaling are layered-layout concepts; the overview has neither. */
  layered: boolean

  objects: GraphNode[]
  selectedObjects: string[]
  onSelectedObjectsChange: (ids: string[]) => void
}

export function ProcessFlowToolbar({
  depthLimited,
  onDepthLimitedChange,
  windowFrom,
  windowTo,
  totalLevels,
  windowSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
  hiddenNodeCount,
  depthDisabled,
  layered,
  objects,
  selectedObjects,
  onSelectedObjectsChange,
}: ProcessFlowToolbarProps) {
  const t = useTranslations()

  const pagerActive = depthLimited && totalLevels > windowSize
  const depthLabel = !depthLimited
    ? t('processes.depthFull')
    : pagerActive
      ? t('processes.depthWindow.label', {
          from: windowFrom,
          to: windowTo,
          total: totalLevels,
        })
      : t('processes.flowView.depthLimited', { size: windowSize })

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ObjectFilter
        objects={objects}
        selected={selectedObjects}
        onChange={onSelectedObjectsChange}
      />

      {/* One segmented control: the centre toggles limited/full AND reads out the slice, the arrows
          page through it. Sankey-only — a depth window is a left-to-right topological slice, which
          only means anything in a layered layout. */}
      {layered && (
        <div
          role="group"
          aria-label={t('processes.depthWindow.groupLabel')}
          className="inline-flex shrink-0 items-center overflow-hidden rounded-md border"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={onPrev}
            disabled={depthDisabled || !canPrev}
            aria-label={t('processes.depthWindow.prev')}
            data-testid="flow-depth-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={depthLimited ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={depthLimited}
            disabled={depthDisabled}
            onClick={() => onDepthLimitedChange(!depthLimited)}
            data-testid="flow-depth-indicator"
            className="h-8 min-w-[9rem] justify-center gap-1.5 rounded-none border-x tabular-nums"
          >
            <Layers className="h-4 w-4" />
            {depthLabel}
            {depthLimited && hiddenNodeCount > 0 && (
              <Badge
                variant="secondary"
                aria-label={t('processes.depthWindow.hiddenCount', {
                  count: hiddenNodeCount,
                })}
                className="ml-1 h-5 px-1.5 text-[10px]"
              >
                +{hiddenNodeCount}
              </Badge>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={onNext}
            disabled={depthDisabled || !canNext}
            aria-label={t('processes.depthWindow.next')}
            data-testid="flow-depth-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

const SEARCH_LIMIT = 30

/** Narrow to the flows touching particular objects. Fed by the graph, so it needs no fetch. */
function ObjectFilter({
  objects,
  selected,
  onChange,
}: {
  objects: GraphNode[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const labelOf = (node: GraphNode) => node.name || `${node.id.slice(0, 8)}…`

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const pool = needle
      ? objects.filter((o) => labelOf(o).toLowerCase().includes(needle))
      : objects
    return pool.slice(0, SEARCH_LIMIT)
  }, [objects, query])

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 justify-between gap-2"
        >
          <Package className="h-4 w-4" />
          {selected.length > 0
            ? t('processes.flowView.filter.selected', {
                count: selected.length,
              })
            : t('processes.filterObjects')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[18rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('processes.flowView.filter.search')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[16rem]">
            <CommandEmpty>{t('common.noResults')}</CommandEmpty>
            <CommandGroup>
              {matches.map((node) => (
                <CommandItem
                  key={node.id}
                  value={node.id}
                  onSelect={() => toggle(node.id)}
                  className="cursor-pointer gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      selected.includes(node.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{labelOf(node)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              {t('processes.clearMaterials')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
