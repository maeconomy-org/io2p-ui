'use client'

import { useTranslations } from 'next-intl'
import { Copy, FileText, IdCard, QrCode, RotateCcw, Trash2 } from 'lucide-react'
import type { ObjectDTO } from 'io2p-client'

import { EntityActionsCell, type EntityRowAction } from '@/components/tables'

export interface ObjectRowActions {
  onViewDetails: (object: ObjectDTO) => void
  onShowQRCode: (object: ObjectDTO) => void
  onViewPassport?: (object: ObjectDTO) => void
  onDuplicate: (object: ObjectDTO) => void
  onCreateTemplate: (object: ObjectDTO) => void
  onDelete: (object: ObjectDTO) => void
  onRestore: (object: ObjectDTO) => void
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
  object: ObjectDTO
  actions: ObjectRowActions
  isDeleting?: boolean
  isRestoring?: boolean
  readOnly?: boolean
}) {
  const t = useTranslations()
  const isDeleted = !!object.deleted

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
