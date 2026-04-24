'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  FilePlus2,
  FileMinus2,
  History as HistoryIcon,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import {
  buildHistoryEvents,
  type HistoryAggregateInput,
  type HistoryEvent,
  type HistoryEventCategory,
} from '../utils/build-history-events'

interface HistoryTabProps {
  aggregate: HistoryAggregateInput | null | undefined
}

type Filter = 'all' | HistoryEventCategory

const FILTERS: Filter[] = [
  'all',
  'metadata',
  'property',
  'value',
  'file',
  'address',
]

function eventIcon(event: HistoryEvent) {
  const cls = 'h-4 w-4 shrink-0'
  if (event.action === 'deleted') {
    if (event.category === 'file')
      return <FileMinus2 className={cn(cls, 'text-destructive')} />
    return <Trash2 className={cn(cls, 'text-destructive')} />
  }
  if (event.action === 'updated')
    return <Pencil className={cn(cls, 'text-muted-foreground')} />
  // created
  switch (event.category) {
    case 'metadata':
      return <Sparkles className={cn(cls, 'text-primary')} />
    case 'file':
      return <FilePlus2 className={cn(cls, 'text-primary')} />
    case 'address':
      return <MapPin className={cn(cls, 'text-primary')} />
    default:
      return <Plus className={cn(cls, 'text-primary')} />
  }
}

function formatBytes(size: number): string {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(ts: string, locale: string): string {
  try {
    return new Date(ts).toLocaleString(locale)
  } catch {
    return ts
  }
}

function resolveEventLabel(
  event: HistoryEvent,
  locale: PropertyDictionaryLocale
): string {
  // Property/value events carry a kebab key + stored label. Prefer the
  // dictionary's localized label when available.
  if (event.category === 'property' || event.category === 'value') {
    const key =
      (event.params.propertyKey as string | undefined) ??
      (event.params.key as string | undefined)
    const stored =
      (event.params.propertyLabel as string | undefined) ??
      (event.params.label as string | undefined)
    return resolvePropertyLabel(key, stored, locale)
  }
  return ''
}

function renderSentence(
  event: HistoryEvent,
  t: ReturnType<typeof useTranslations>,
  locale: PropertyDictionaryLocale
): string {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(event.params)) {
    params[k] = String(v)
  }
  if (event.category === 'file' && 'size' in event.params) {
    params.size = formatBytes(event.params.size as number)
  }
  const resolvedLabel = resolveEventLabel(event, locale)
  if (resolvedLabel) {
    params.label = resolvedLabel
    params.propertyLabel = resolvedLabel
  }
  return t(event.translationKey, params)
}

export function HistoryTab({ aggregate }: HistoryTabProps) {
  const t = useTranslations()
  const rawLocale = useLocale()
  const locale: PropertyDictionaryLocale = rawLocale === 'nl' ? 'nl' : 'en'

  const [filter, setFilter] = useState<Filter>('all')

  const events = useMemo(() => buildHistoryEvents(aggregate), [aggregate])
  const visible = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => e.category === filter)
  }, [events, filter])

  if (events.length === 0) {
    return (
      <div className="space-y-3 pt-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('objects.tabs.history')}
        </h3>
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <HistoryIcon className="h-8 w-8" />
          <p className="text-sm">{t('objects.history.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('objects.tabs.history')}
        </h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger
            className="h-8 w-[160px] text-xs"
            aria-label={t('objects.history.filterLabel')}
            data-testid="history-filter-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f} value={f} data-testid={`history-filter-${f}`}>
                {t(`objects.history.filters.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p
          className="py-6 text-center text-sm text-muted-foreground"
          data-testid="history-empty-filter"
        >
          {t('objects.history.emptyFilter')}
        </p>
      ) : (
        <ol
          className="space-y-2"
          data-testid="history-event-list"
          aria-label={t('objects.history.listLabel')}
        >
          {visible.map((event) => (
            <li
              key={event.id}
              data-testid={`history-event-${event.category}-${event.action}`}
              className={cn(
                'flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2',
                event.action === 'deleted' && 'bg-destructive/5'
              )}
            >
              <div className="pt-0.5">{eventIcon(event)}</div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm leading-snug break-words',
                    event.action === 'deleted' &&
                      'text-muted-foreground line-through decoration-muted-foreground/60'
                  )}
                >
                  {renderSentence(event, t, locale)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatTimestamp(event.timestamp, rawLocale)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
