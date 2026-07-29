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
 * Falls back to the id when the directory cannot resolve a user: an unresolved owner should look
 * unresolved, not absent.
 */
export function OwnerCell({
  system,
  ownerUserId,
}: {
  system?: boolean
  ownerUserId?: string
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  // Only pay for the directory when there is actually a foreign owner to name.
  const isForeign = !system && !!ownerUserId && ownerUserId !== userId
  const { nameOf } = useUserDirectory({ enabled: isForeign })

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
      {nameOf(ownerUserId)}
    </Badge>
  )
}
