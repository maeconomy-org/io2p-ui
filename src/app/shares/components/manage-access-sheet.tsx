'use client'

import type { SharedByMeItem } from 'io2p-client'

import { ShareSheet, type ShareResourceType } from '@/components/access'

import { useResourceDirectory } from '../hooks/use-resource-directory'

/**
 * Opens the entity Share sheet from a shared-by-me row.
 *
 * The rollup gives `{type, id}` with no name, so the label comes from the same cached
 * object/process directory the table behind it already loaded — no extra request at all.
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
  const { nameOf } = useResourceDirectory(true)
  const name = nameOf(resource.type, resource.id) ?? resource.id

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
