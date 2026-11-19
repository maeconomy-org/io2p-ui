'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { isCappedTotal, TOTAL_CAP } from '@/lib/list-total'

/**
 * A list total as the user reads it: "1,000+" (nl "1.000+") for a capped total, else the number
 * in the locale's format. `label` is the same for a screen reader ("more than 1,000").
 */
export function useFormatTotal() {
  const t = useTranslations('common')
  const format = useFormatter()

  return {
    /** "{count}+" for a lower limit that is not the cap itself, such as a sum over capped lists. */
    moreThan: (count: number) => t('totalMoreThan', { count }),
    text: (total: number, capped: boolean) =>
      isCappedTotal(total, capped)
        ? t('totalMoreThan', { count: TOTAL_CAP })
        : format.number(total),
    label: (total: number, capped: boolean) =>
      isCappedTotal(total, capped)
        ? t('totalMoreThanLabel', { count: TOTAL_CAP })
        : format.number(total),
  }
}
