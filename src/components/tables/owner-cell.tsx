'use client'

import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui'
import { useAuth } from '@/contexts'
import { useUserDirectory } from '@/hooks/api/users'

/**
 * Who a library item belongs to — for formulas, constants and templates, which share the shape.
 *
 * Three cases, and they are genuinely different things rather than one scale:
 *  - **built-in** (`system: true`) — the node's, seeded, nobody's to edit;
 *  - **mine** — resolved by comparing `ownerUserId` to the signed-in user, so the common case reads
 *    as "Me" rather than as your own name, which is noise on every row;
 *  - **someone else's** — their display name or email, because the list will show shared items and
 *    a raw uuid answers nothing.
 *
 * Falls back to the id when nothing resolves the user: an unresolved owner should look unresolved,
 * not absent.
 */
export function OwnerCell({
  system,
  ownerUserId,
  ownerName,
}: {
  system?: boolean
  ownerUserId?: string
  /**
   * The name the NODE resolved, where the read carries one (`ShareDTO.ownerName` today; the five
   * entity types when Pass 2 lands). Given it, no directory is fetched at all — which is the point:
   * the directory is one page, so it names the first N users and no more.
   */
  ownerName?: string
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  // Only pay for the directory when there is a foreign owner AND the read did not already name them.
  const isForeign = !system && !!ownerUserId && ownerUserId !== userId
  const { nameOf } = useUserDirectory({ enabled: isForeign && !ownerName })

  if (system) {
    return (
      <Badge variant="outline" className="h-5">
        {t('common.builtIn')}
      </Badge>
    )
  }

  if (!ownerUserId || ownerUserId === userId) {
    return (
      <Badge variant="secondary" className="h-5">
        {t('common.me')}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="h-5 max-w-[12rem] truncate">
      {ownerName ?? nameOf(ownerUserId)}
    </Badge>
  )
}
