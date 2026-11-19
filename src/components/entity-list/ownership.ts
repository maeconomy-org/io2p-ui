/** The owner fields every library row carries. */
export interface OwnedListItem {
  system?: boolean
  ownerUserId?: string
}

/**
 * Whether the signed-in user may change a formula, constant or template.
 *
 * These three are shared READ-ONLY — the node refuses any other permission on them
 * (`internal-docs/10-access-model-map.md`), so being able to see one says nothing about being able
 * to write it, and the owner is the only writer. A built-in has no owner and belongs to the node.
 *
 * Absent `ownerUserId` on a non-system row means the node could not resolve the owner, not that
 * there is none — refusing there would hide the actions on the user's own rows.
 */
export function canWriteLibraryItem(
  item: OwnedListItem,
  viewerId?: string
): boolean {
  if (item.system) return false
  if (!item.ownerUserId) return true
  return item.ownerUserId === viewerId
}
