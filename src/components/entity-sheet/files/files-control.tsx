'use client'

import { useTranslations } from 'next-intl'
import { ChevronDown, Paperclip } from 'lucide-react'

import { cn } from '@/lib/utils'

// The toggle's own look (FilesToggle), and the in-field look beside an input's other buttons.
const TOGGLE =
  'flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const FIELD =
  'flex h-8 shrink-0 items-center gap-0.5 border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground'
const ROW_ATTACH =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

/**
 * The one files control of a thing that holds files (a property, a value, a flow): with none it
 * attaches, with some it shows the count and opens their list. Without `onAttach` (read mode) an
 * empty thing shows nothing.
 *
 * ONE button element in every state, so the first attach (or removing the last file) does not
 * replace it: the attach dialog hands focus back to this button, and a replaced one is gone.
 * `field` sits inside an input's border, beside its other in-field buttons; `row` sits in a header.
 */
export function FilesControl({
  count,
  open,
  onToggle,
  controls,
  label,
  onAttach,
  attachTestId,
  variant,
}: {
  count: number
  open: boolean
  onToggle: () => void
  /** The id of the list this toggle opens. */
  controls: string
  /** What the files belong to, for a screen reader: "Files on this value". */
  label: string
  onAttach?: () => void
  attachTestId?: string
  variant: 'field' | 'row'
}) {
  const t = useTranslations()
  const listing = count > 0

  if (!listing && !onAttach) return null

  return (
    <button
      type="button"
      onClick={listing ? onToggle : onAttach}
      aria-expanded={listing ? open : undefined}
      aria-controls={listing ? controls : undefined}
      aria-label={listing ? `${label} (${count})` : t('objects.files.attach')}
      title={listing ? undefined : t('objects.files.attach')}
      data-testid={listing ? 'files-toggle' : attachTestId}
      className={variant === 'field' ? FIELD : listing ? TOGGLE : ROW_ATTACH}
    >
      <Paperclip
        className={!listing && variant === 'field' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
      />
      {listing && (
        <>
          <span className="tabular-nums">{count}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </>
      )}
    </button>
  )
}
