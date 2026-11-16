'use client'

import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, Button } from '@/components/ui'
import { listErrorMessage } from '@/lib/list-error'
import { cn } from '@/lib/utils'

/** The reason a list could not load, in English from the node when it gave one. */
function ListErrorText({ error }: { error: unknown }) {
  const t = useTranslations('common')
  const message = listErrorMessage(error)
  if (message.key === 'common.listFailed') return <>{t('listFailed')}</>
  // `lang`: a screen reader reads the node's English with English sounds inside a Dutch page.
  return (
    <>
      {t('listRefused')} <span lang="en">{message.detail}</span>
    </>
  )
}

/**
 * Where a table's rows would be: why they did not load, with a retry. It mounts once per failure,
 * so `role="alert"` announces it once.
 */
export function ListErrorAlert({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  const t = useTranslations('common')
  return (
    <Alert
      variant="destructive"
      data-testid="list-error"
      className={cn(
        'bg-destructive/10 text-sm font-medium text-red-700 dark:text-red-400',
        className
      )}
    >
      {/* Wrapped: Alert positions a direct-child svg absolutely. red-700/400: --destructive text
          on this tint is below 4.5:1. */}
      <div className="flex flex-wrap items-center gap-2 text-left">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 break-words">
          <ListErrorText error={error} />
        </span>
        {onRetry && (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t('listRetry')}
          </Button>
        )}
      </div>
    </Alert>
  )
}

/**
 * A picker's list could not load. A status region that stays mounted OUTSIDE the listbox: a screen
 * reader skips what a listbox holds that is not an option, and `role="alert"` would announce again
 * on every keystroke that fails.
 */
export function PickerListError({ error }: { error: unknown }) {
  return (
    <p
      role="status"
      data-testid="picker-list-error"
      className={cn(
        'text-xs font-medium text-red-700 dark:text-red-400',
        error != null && 'border-b px-3 py-2'
      )}
    >
      {error != null && <ListErrorText error={error} />}
    </p>
  )
}
