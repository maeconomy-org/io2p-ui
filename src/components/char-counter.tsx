'use client'

import { useTranslations } from 'next-intl'

import { charCount, cn } from '@/lib/utils'

/** "123 / 2,000" under a text field; says "too long" in words too, not only in red. */
export function CharCounter({
  id,
  value,
  max,
}: {
  id: string
  value: string | null | undefined
  max: number
}) {
  const t = useTranslations('common')
  const count = charCount(value)
  const over = count > max

  return (
    <p
      id={id}
      data-testid="char-counter"
      className={cn(
        'text-right text-xs tabular-nums text-muted-foreground',
        over && 'font-medium text-destructive'
      )}
    >
      {t(over ? 'charCountOver' : 'charCount', { count, max })}
    </p>
  )
}
