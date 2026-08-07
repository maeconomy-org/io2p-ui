'use client'

import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'

import { Badge, Button } from '@/components/ui'

/**
 * A soft-deleted property or value. Nothing is ever hidden on delete — the row stays, struck through
 * and marked, so the deletion is visible and reversible rather than a silent disappearance.
 *
 * `onRestore` is omitted in read mode: restoring is a draft edit that only Save can commit, so
 * offering the button where there is no Save would promise something the view can't deliver. Matches
 * the file treatment in `file-row`.
 */
export function DeletedRow({
  label,
  onRestore,
  testId = 'deleted-row',
}: {
  label: string
  onRestore?: () => void
  /** Callers pass an indexed id so a spec can name WHICH row it means. */
  testId?: string
}) {
  const t = useTranslations()

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5"
      data-testid={testId}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-destructive line-through">
        {label}
      </span>
      <Badge
        variant="outline"
        className="shrink-0 border-destructive text-[10px] text-destructive"
      >
        {t('common.deleted')}
      </Badge>
      {onRestore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          aria-label={`${t('common.restore')} ${label}`}
          data-testid={`${testId}-restore`}
          onClick={onRestore}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {t('common.restore')}
        </Button>
      )}
    </div>
  )
}
