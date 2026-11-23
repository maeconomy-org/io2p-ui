'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** The shadcn Calendar on react-day-picker 9. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames()
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn('w-fit', defaults.root),
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 aria-disabled:opacity-40'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 aria-disabled:opacity-40'
        ),
        month_caption: 'flex h-7 w-full items-center justify-center px-8',
        caption_label: 'text-sm font-medium',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-9 select-none text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: cn(
          'relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        range_start:
          'rounded-l-md bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_end:
          'rounded-r-md bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_middle:
          'rounded-none [&>button]:bg-accent [&>button]:text-accent-foreground',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:font-semibold',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', chevronClass)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', chevronClass)} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
