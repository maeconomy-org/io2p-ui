'use client'

import { useTranslations } from 'next-intl'

import { DeleteConfirmationDialog } from '@/components/dialogs'
import { useObjects } from '@/hooks/api/entities'
import type { ObjectListItem } from 'io2p-client'

/**
 * Delete confirm for a single object, with the size of what stays behind.
 *
 * Delete is non-cascading (D32/D74): the descendants keep their edges and stay live, so the only
 * thing that changes for them is that their parent stops appearing in lists and in rollups. The
 * count is the whole subtree, not `row.childCount` — dropping a node strands its grandchildren too.
 */
export function DeleteObjectDialog({
  object,
  onOpenChange,
  onDelete,
}: {
  object: ObjectListItem
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  const t = useTranslations()

  // `size: 1` — only `page.totalElements` is read. `refNames: false` skips the parent-name
  // resolution the node would otherwise do per row.
  const { data, isPending } = useObjects().useSubtree(object.id, {
    size: 1,
    refNames: false,
  })

  const descendants = data?.page.totalElements ?? 0

  // `?ancestor=` lags a write, so a just-moved child can be missing for a moment. Falling back to
  // the row's own direct-child count keeps the dialog from claiming zero while children are visible
  // on the page behind it.
  const count = Math.max(descendants, object.childCount ?? 0)

  const description =
    isPending || count === 0
      ? t('objects.deleteConfirmDescription', { name: object.name })
      : t('objects.deleteConfirmDescriptionWithChildren', {
          name: object.name,
          count,
        })

  return (
    <DeleteConfirmationDialog
      open
      onOpenChange={onOpenChange}
      objectName={object.name}
      description={description}
      onDelete={onDelete}
    />
  )
}
