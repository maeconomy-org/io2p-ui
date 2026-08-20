'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ObjectListItem } from 'io2p-client'

import {
  OwnerCell,
  actionsColumn,
  coverColumn,
  idColumn,
  nameColumn,
  selectColumn,
  textColumn,
  timestampColumn,
} from '@/components/entity-list'

import { ObjectActionsCell } from './object-actions-cell'

export interface ObjectColumnActions {
  onViewDetails: (object: ObjectListItem) => void
  onShowQRCode: (object: ObjectListItem) => void
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
  isDeleting?: boolean
  isRestoring?: boolean
}

/**
 * Columns the user may hide. `select`, `name` and `actions` are deliberately
 * absent — a row with no name has no identity, and one with no actions cannot
 * be acted on. An explicit list rather than a filter over the column array, so
 * a column added later is not offered by accident.
 */
export const OBJECT_TOGGLEABLE_COLUMNS = [
  { id: 'cover', labelKey: 'objects.fields.cover' },
  { id: 'id', labelKey: 'objects.fields.uuid' },
  { id: 'childCount', labelKey: 'objects.fields.children' },
  { id: 'createdBy', labelKey: 'common.owner' },
  { id: 'createdAt', labelKey: 'objects.fields.created' },
  { id: 'updatedAt', labelKey: 'objects.fields.updated' },
] as const

export function buildObjectColumns({
  t,
  actions,
  enableSelection = false,
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
    // `childCount` is populated only because the list asks `withChildCounts`.
    // It is `0` for a leaf and absent if that flag ever goes away, so `?? '—'`
    // distinguishes "no children" from "not asked for".
    textColumn<ObjectListItem>(
      'childCount',
      t('objects.fields.children'),
      (o) => (o.childCount === undefined ? undefined : String(o.childCount))
    ),
    textColumn<ObjectListItem>(
      'createdBy',
      t('common.owner'),
      (o): ReactNode => (
        <OwnerCell ownerUserId={o.createdBy} ownerName={o.createdByName} />
      )
    ),
    timestampColumn<ObjectListItem>(
      'createdAt',
      t('objects.fields.created'),
      (o) => o.createdAt,
      { sortable: true }
    ),
    timestampColumn<ObjectListItem>(
      'updatedAt',
      t('objects.fields.updated'),
      (o) => o.updatedAt,
      { sortable: true }
    ),
    actionsColumn<ObjectListItem>(
      (o): ReactNode => (
        <ObjectActionsCell
          object={o}
          actions={actions}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
        />
      ),
      t('common.actions')
    )
  )

  return cols
}
