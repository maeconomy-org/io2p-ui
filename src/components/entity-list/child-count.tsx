'use client'

import { useTranslations } from 'next-intl'

import { useFormatTotal } from '@/hooks/ui/use-format-total'

import { CountUnavailable } from './count-unavailable'

/**
 * A row's `childCount`: "—" when the node did not count it, nothing for a leaf, "1,000+" (read
 * aloud as "more than 1,000") for a capped count.
 */
export function ChildCount({
  count,
  className,
  testId,
}: {
  count: number | undefined
  className?: string
  testId?: string
}) {
  const t = useTranslations('common')
  const total = useFormatTotal()

  if (count === undefined) {
    return <CountUnavailable label={t('countUnavailable')} />
  }
  if (count === 0) return null

  return (
    <span className={className} data-testid={testId}>
      <span aria-hidden="true">{total.text(count, true)}</span>
      <span className="sr-only">{total.label(count, true)}</span>
    </span>
  )
}
