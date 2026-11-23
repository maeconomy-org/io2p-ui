'use client'

import * as React from 'react'
import { CalendarDays } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { enUS, nl } from 'react-day-picker/locale'

import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

import { dayOf, isoDay, rangePresets, type DayRange } from './date-ranges'
import { useDayText } from './use-day-text'

interface DateRangeFieldProps {
  id: string
  /** Also the `data-field` of the trigger, so the panel can focus it. */
  field: string
  from: string
  to: string
  labelledBy: string
  invalid?: boolean
  describedBy?: string
  onChange: (range: DayRange) => void
}

/**
 * One button for a day range. The first day picked starts the range; the second ends it. A range
 * left with one day means "from that day", the same as a typed `created:2026-01-01..`.
 */
export function DateRangeField({
  id,
  field,
  from,
  to,
  labelledBy,
  invalid,
  describedBy,
  onChange,
}: DateRangeFieldProps) {
  const t = useTranslations('filterPanel')
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  // The first click of an opening starts a new range, even when one is already set.
  const [picking, setPicking] = React.useState(false)
  const day = useDayText()

  const text =
    from && to
      ? from === to
        ? day(from)
        : `${day(from)} – ${day(to)}`
      : from
        ? t('dateFromOnly', { day: day(from) })
        : to
          ? t('dateToOnly', { day: day(to) })
          : t('anyDate')

  const pick = (date: Date) => {
    const iso = isoDay(date)
    if (!picking || !from) {
      onChange({ from: iso, to: '' })
      setPicking(true)
    } else {
      onChange(iso < from ? { from: iso, to: from } : { from, to: iso })
      setPicking(false)
    }
  }

  const selected = from
    ? { from: dayOf(from)!, to: to ? dayOf(to)! : undefined }
    : undefined

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setPicking(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-field={field}
          aria-labelledby={`${labelledBy} ${id}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-9 w-full justify-start gap-2 px-3 font-normal',
            !from && !to && 'text-muted-foreground',
            invalid && 'border-destructive'
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="truncate">{text}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div
            role="group"
            aria-label={t('ranges')}
            className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r"
          >
            {rangePresets(new Date()).map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 justify-start px-2 font-normal"
                data-preset={preset.id}
                onClick={() => {
                  onChange(preset)
                  setOpen(false)
                }}
              >
                {t(`preset.${preset.id}`)}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            locale={locale === 'nl' ? nl : enUS}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected?.from}
            onSelect={() => {}}
            onDayClick={pick}
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <p className="text-xs text-muted-foreground">{t('rangeHint')}</p>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                onChange({ from: '', to: '' })
                setOpen(false)
              }}
            >
              {t('clear')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => setOpen(false)}
            >
              {t('done')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
