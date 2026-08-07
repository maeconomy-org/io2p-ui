'use client'

import { useTranslations } from 'next-intl'
import {
  Copy,
  FileText,
  IdCard,
  QrCode,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  EntityActionsCell,
  type EntityRowAction,
} from '@/components/entity-list'
import { useAuth } from '@/contexts'

export interface ObjectRowActions {
  onViewDetails: (object: ObjectListItem) => void
  onShowQRCode: (object: ObjectListItem) => void
  onViewPassport?: (object: ObjectListItem) => void
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
 * templating from something the user has thrown away is never what they meant. `readOnly` drops the
 * menu entirely, leaving just Details.
 */
export function ObjectActionsCell({
  object,
  actions,
  isDeleting,
  isRestoring,
  readOnly,
}: {
  object: ObjectListItem
  actions: ObjectRowActions
  isDeleting?: boolean
  isRestoring?: boolean
  readOnly?: boolean
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  const isDeleted = !!object.deleted
  // Only the owner may read a resource's grant list — the node 403s anyone else — so offering the
  // action to a sharee would open a sheet that can only fail.
  const canShare = !!actions.onShare && object.createdBy === userId

  const rowActions: EntityRowAction[] = []

  if (!readOnly) {
    if (actions.onViewPassport) {
      rowActions.push({
        key: 'view-passport',
        label: t('objects.actions.viewPassport'),
        icon: IdCard,
        onSelect: () => actions.onViewPassport?.(object),
      })
    }
    rowActions.push({
      key: 'show-qr',
      label: t('objects.actions.showQrCode'),
      icon: QrCode,
      onSelect: () => actions.onShowQRCode(object),
    })

    if (!isDeleted) {
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
