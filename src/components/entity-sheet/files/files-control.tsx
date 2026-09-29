'use client'

import { useTranslations } from 'next-intl'
import { Paperclip } from 'lucide-react'

import { Button } from '@/components/ui'

import { FilesToggle } from './files-toggle'

/**
 * The one files control of a thing that holds files (a property, a value, a flow): with none it
 * attaches, with some it shows the count and opens their list. Without `onAttach` (read mode) an
 * empty thing shows nothing.
 *
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

  if (count > 0) {
    return (
      <FilesToggle
        count={count}
        open={open}
        onToggle={onToggle}
        controls={controls}
        label={label}
        className={
          variant === 'field'
            ? 'h-8 rounded-none border-l px-2.5 hover:bg-transparent'
            : undefined
        }
      />
    )
  }

  if (!onAttach) return null

  return variant === 'field' ? (
    <button
      type="button"
      onClick={onAttach}
      title={t('objects.files.attach')}
      aria-label={t('objects.files.attach')}
      data-testid={attachTestId}
      className="flex h-8 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Paperclip className="h-4 w-4" />
    </button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      aria-label={t('objects.files.attach')}
      title={t('objects.files.attach')}
      data-testid={attachTestId}
      onClick={onAttach}
    >
      <Paperclip className="h-3.5 w-3.5" />
    </Button>
  )
}
