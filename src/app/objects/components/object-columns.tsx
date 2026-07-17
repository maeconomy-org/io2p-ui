'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ObjectDTO } from 'io2p-client'

import {
  ObjectActionsCell,
  actionsColumn,
  idColumn,
  nameColumn,
  selectColumn,
  timestampColumn,
} from '@/components/tables'

export interface ObjectColumnActions {
  onViewDetails: (object: ObjectDTO) => void
  onShowQRCode: (object: ObjectDTO) => void
  onViewPassport: (object: ObjectDTO) => void
  onDuplicate: (object: ObjectDTO) => void
  onCreateTemplate: (object: ObjectDTO) => void
  onDelete: (object: ObjectDTO) => void
  onRestore: (object: ObjectDTO) => void
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
}: BuildObjectColumnsOptions): ColumnDef<ObjectDTO, unknown>[] {
  const cols: ColumnDef<ObjectDTO, unknown>[] = []

  if (enableSelection) cols.push(selectColumn<ObjectDTO>())

  cols.push(
    nameColumn<ObjectDTO>((o) => o.name, {
      header: t('objects.fields.name'),
      sortable: true,
      getChildCount: (o) => o.childCount,
      getDeleted: (o) => o.deleted,
      deletedLabel: t('objects.deletedBadge'),
      childrenTooltip: (count) => t('objects.childrenTooltip', { count }),
    }),
    idColumn<ObjectDTO>((o) => o.id, t('objects.fields.uuid')),
    timestampColumn<ObjectDTO>(
      'createdAt',
      t('objects.fields.created'),
      (o) => o.createdAt,
      { sortable: true }
    ),
    actionsColumn<ObjectDTO>(
      (o): ReactNode => (
        <ObjectActionsCell
          object={o}
          isDeleted={o.deleted}
          onViewDetails={actions.onViewDetails}
          onShowQRCode={actions.onShowQRCode}
          onViewPassport={actions.onViewPassport}
          onDuplicate={actions.onDuplicate}
          onCreateTemplate={actions.onCreateTemplate}
          onDelete={actions.onDelete}
          onRestore={actions.onRestore}
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
