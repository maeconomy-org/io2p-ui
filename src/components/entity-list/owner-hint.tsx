'use client'

import { useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'

/**
 * Who a row belongs to, for the pickers — a single line of muted text beside the name.
 *
 * Renders NOTHING for your own rows and for built-ins. A picker is a list of candidates you are
 * about to act on, so a badge on every row is noise; the signal is the exception. `OwnerCell` is
 * the table counterpart and labels every row, because a column with gaps reads as missing data.
 */
export function OwnerHint({
  system,
  ownerUserId,
  ownerName,
}: {
  system?: boolean
  ownerUserId?: string
  ownerName?: string
}) {
  const t = useTranslations()
  const { userId } = useAuth()

  if (system || !ownerUserId || ownerUserId === userId) return null

  return (
    <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">
      {ownerName ?? t('common.sharedWithYou')}
    </span>
  )
}
