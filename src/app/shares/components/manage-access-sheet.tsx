'use client'

import type { SharedByMeItem } from 'io2p-client'

import { ShareSheet, type ShareResourceType } from '@/components/access'

/**
 * Opens the entity Share sheet from a shared-by-me row, for ANY of the five resource types.
 *
 * The rollup resolves `name` on read, so the title comes straight off the row.
 *
 * The row used to be gated to objects and processes because `GET /v1/access` refused the library
 * types. That was widened (io2p-core PR #46) and the gate outlived it, leaving a Manage button that
 * rendered enabled and did nothing — a shared formula, constant or template could be created and
 * then never revoked.
 *
 * Opens the sheet in DIRECT-ONLY mode: this tab is one half of a split by source, and it has to
 * stay that half all the way into the detail.
 */
export function ManageAccessSheet({
  resource,
  onClose,
}: {
  resource: SharedByMeItem['resource']
  onClose: () => void
}) {
  const name = resource.name ?? resource.id

  return (
    <ShareSheet
      open
      onOpenChange={(open) => !open && onClose()}
      target={{
        type: resource.type as ShareResourceType,
        id: resource.id,
        name,
      }}
      // Asserted, not computed: `SharedByMeItem` carries no permission and no owner, so there is
      // nothing here to decide it from.
      //
      // True for the common case, and the reasoning it replaces was not: granting needs `share`,
      // NOT admin, so "they granted it, therefore they hold admin" does not follow. A `share`
      // grantee who granted this row lands on a 403 they cannot act on. Rare — the usual granter
      // is the owner, who does hold admin — and not fixable from here: the row would have to carry
      // the caller's permission for this to be an answer rather than a guess.
      canViewGrants
      // This sheet opens from the DIRECT shares tab. A Share's grants are managed on the Share, so
      // showing them here would put back the mixture that tab exists to separate.
      directOnly
    />
  )
}
