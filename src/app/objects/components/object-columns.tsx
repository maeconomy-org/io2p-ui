'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ObjectListItem } from 'io2p-client'

import {
  actionsColumn,
  coverColumn,
  idColumn,
  nameColumn,
  selectColumn,
  timestampColumn,
} from '@/components/tables'

import { ObjectActionsCell } from './object-actions-cell'

export interface ObjectColumnActions {
  onViewDetails: (object: ObjectListItem) => void
  onShowQRCode: (object: ObjectListItem) => void
  onViewPassport: (object: ObjectListItem) => void
  onDuplicate: (object: ObjectListItem) => void
  onCreateTemplate: (object: ObjectListItem) => void
  onShare?: (object: ObjectListItem) => void
  onDelete: (object: ObjectListItem) => void
  onRestore: (object: ObjectListItem) => void
}

interface BuildObjectColumnsOptions {
  t: (key: string, values?: Record<string, string | number | Date>) => string
  actions: ObjectColumnActions
  enableSelection?: boolean
  readOnly?: boolean
  isDeleting?: boolean
  isRestoring?: boolean
}

export function buildObjectColumns({
  t,
  actions,
  enableSelection = false,
  readOnly = false,
  isDeleting = false,
  isRestoring = false,
}: BuildObjectColumnsOptions): ColumnDef<ObjectListItem, unknown>[] {
  const cols: ColumnDef<ObjectListItem, unknown>[] = []

  if (enableSelection) cols.push(selectColumn<ObjectListItem>())

  // `cover` is a ROOT field on the entity, which is the only reason a thumbnail can appear here:
  // it survives the lean list select, where `files` does not.
  cols.push(
    coverColumn<ObjectListItem>(
      (o) => o.cover,
      (o) => o.name
    )
  )

  cols.push(
    nameColumn<ObjectListItem>((o) => o.name, {
      header: t('objects.fields.name'),
      sortable: true,
      getChildCount: (o) => o.childCount,
      getDeleted: (o) => o.deleted,
      deletedLabel: t('objects.deletedBadge'),
      childrenTooltip: (count) => t('objects.childrenTooltip', { count }),
    }),
    idColumn<ObjectListItem>((o) => o.id, t('objects.fields.uuid')),
    timestampColumn<ObjectListItem>(
      'createdAt',
      t('objects.fields.created'),
      (o) => o.createdAt,
      { sortable: true }
    ),
    actionsColumn<ObjectListItem>(
      (o): ReactNode => (
        <ObjectActionsCell
          object={o}
          actions={actions}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
          readOnly={readOnly}
        />
      ),
      t('common.actions')
    )
  )

  return cols
}
