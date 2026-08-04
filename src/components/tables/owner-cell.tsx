'use client'

import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui'
import { useAuth } from '@/contexts'

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
 * Falls back to the id when the node could not resolve the user: an unresolved owner should look
 * unresolved, not absent.
 */
export function OwnerCell({
  system,
  ownerUserId,
  ownerName,
}: {
  system?: boolean
  ownerUserId?: string
  /**
   * The name the NODE resolved on read. Every read that carries an owner now carries this, so there
   * is no client-side lookup left: absent means the node could not resolve the user at all, and a
   * page of the directory could not have resolved them either.
   */
  ownerName?: string
}) {
  const t = useTranslations()
  const { userId } = useAuth()

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
      {ownerName ?? ownerUserId}
    </Badge>
  )
}
