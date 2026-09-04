'use client'

import { useTranslations } from 'next-intl'
import { Copy, FileText, QrCode, RotateCcw, Share2, Trash2 } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  EntityActionsCell,
  type EntityRowAction,
  canDelete,
  canReshare,
  permissionWhenKnown,
} from '@/components/entity-list'
import { useAuth } from '@/contexts'

export interface ObjectRowActions {
  onViewDetails: (object: ObjectListItem) => void
  onShowQRCode: (object: ObjectListItem) => void
  onDuplicate: (object: ObjectListItem) => void
  onCreateTemplate: (object: ObjectListItem) => void
  /** Omitted where sharing has nowhere to open, e.g. an embedded picker. */
  onShare?: (object: ObjectListItem) => void
  onDelete: (object: ObjectListItem) => void
  onRestore: (object: ObjectListItem) => void
}

/**
 * Row actions for the objects table.
 *
 * A soft-deleted object offers Restore instead of the edit-shaped actions — duplicating or
 * templating from something the user has thrown away is never what they meant.
 *
 * Each action is gated at the rung the node guards it with, so the menu narrows to what this
 * viewer can actually do rather than being present or absent as a whole.
 */
export function ObjectActionsCell({
  object,
  actions,
  isDeleting,
  isRestoring,
}: {
  object: ObjectListItem
  actions: ObjectRowActions
  isDeleting?: boolean
  isRestoring?: boolean
}) {
  const t = useTranslations()
  const { userId, authLoading } = useAuth()
  const isDeleted = !!object.deleted
  // The node's verdict, falling back to the owner — objects have no separate owner, so their author
  // holds `admin` on them.
  const permission = permissionWhenKnown(object, userId, authLoading)
  // Reading the grant list needs `share`; the node 403s anything less, so offering it to a plain
  // reader would open a sheet that can only fail.
  const canShare = !!actions.onShare && canReshare(permission)

  const rowActions: EntityRowAction[] = []

  rowActions.push({
    key: 'show-qr',
    label: t('objects.actions.showQrCode'),
    icon: QrCode,
    onSelect: () => actions.onShowQRCode(object),
  })

  if (!isDeleted) {
    // Duplicate and Create-template READ this object and write a new one the viewer will own, so
    // they are offered to anyone who can see it.
    rowActions.push(
      {
        key: 'duplicate',
        label: t('objects.duplicate.action'),
        icon: Copy,
        onSelect: () => actions.onDuplicate(object),
      },
      {
        key: 'create-template',
        label: t('objects.createTemplate'),
        icon: FileText,
        onSelect: () => actions.onCreateTemplate(object),
      }
    )
    if (canShare) {
      rowActions.push({
        key: 'share',
        label: t('access.share'),
        icon: Share2,
        onSelect: () => actions.onShare?.(object),
      })
    }
  }

  // Both are guarded at `admin`, not `write`.
  if (canDelete(permission)) {
    rowActions.push(
      isDeleted
        ? {
            key: 'restore',
            label: t('objects.restoreTitle'),
            icon: RotateCcw,
            separated: true,
            disabled: isRestoring,
            onSelect: () => actions.onRestore(object),
          }
        : {
            key: 'delete',
            label: t('common.delete'),
            icon: Trash2,
            destructive: true,
            separated: true,
            disabled: isDeleting,
            onSelect: () => actions.onDelete(object),
          }
    )
  }

  return (
    <EntityActionsCell
      testIdPrefix="object"
      onViewDetails={() => actions.onViewDetails(object)}
      actions={rowActions}
    />
  )
}
