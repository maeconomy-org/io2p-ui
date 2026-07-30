'use client'

import type { SharedByMeItem } from 'io2p-client'

import { ShareSheet, type ShareResourceType } from '@/components/access'
import { useObjects, useProcesses } from '@/hooks/api/entities'

/**
 * Opens the entity Share sheet from a shared-by-me row.
 *
 * The rollup gives `{type, id}` with no name, so the name is resolved here — ONE request, when the
 * sheet opens, rather than one per row on every page render. A row summarises; only opening it
 * pays for the label.
 *
 * The caller has already established the resource is an object or a process; the library types
 * cannot be managed because `GET /v1/access` refuses them.
 */
export function ManageAccessSheet({
  resource,
  onClose,
}: {
  resource: SharedByMeItem['resource']
  onClose: () => void
}) {
  const isObject = resource.type === 'object'

  const { data: object } = useObjects().useGet(
    isObject ? resource.id : undefined
  )
  const { data: process } = useProcesses().useGet(
    isObject ? undefined : resource.id
  )

  const name = (isObject ? object?.name : process?.name) ?? resource.id

  return (
    <ShareSheet
      open
      onOpenChange={(open) => !open && onClose()}
      target={{
        type: resource.type as ShareResourceType,
        id: resource.id,
        name,
      }}
      // The rollup only ever returns what the CALLER has shared, so they granted it and therefore
      // hold admin — no ownership check to make.
      isOwner
    />
  )
}
