'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, Button } from '@/components/ui'
import { listErrorMessage } from '@/lib/list-error'
import { cn } from '@/lib/utils'

/**
 * The reason a list could not load, in English from the node when it gave one. `tryAgain` asks
 * for a retry in words, where no button offers one.
 */
function ListErrorText({
  error,
  tryAgain = false,
}: {
  error: unknown
  tryAgain?: boolean
}) {
  const t = useTranslations('common')
  const message = listErrorMessage(error)
  if (message.key === 'common.listFailed') {
    return <>{t(tryAgain ? 'listFailedTryAgain' : 'listFailed')}</>
  }
  // `lang`: a screen reader reads the node's English with English sounds inside a Dutch page.
  return (
    <>
      {t('listRefused')} <span lang="en">{message.detail}</span>
    </>
  )
}

/**
 * Where a table's rows would be: why they did not load, with a retry. It mounts once per failure,
 * so `role="alert"` announces it once. A refused list (400/422) gets no retry: the node answers
 * the same until the search changes. `retrying` is true while a retry runs, which can take as
 * long as the client timeout; the alert stays up until the answer.
 */
export function ListErrorAlert({
  error,
  onRetry,
  retrying = false,
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  const t = useTranslations('common')
  const canRetry =
    onRetry !== undefined && listErrorMessage(error).key === 'common.listFailed'
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
        {canRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying}
          >
            {retrying && (
              <Loader2
                className="mr-1 h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            )}
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
      {error != null && <ListErrorText error={error} tryAgain />}
    </p>
  )
}
