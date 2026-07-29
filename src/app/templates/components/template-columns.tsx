'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { TemplateDTO } from 'io2p-client'

import { Badge } from '@/components/ui'
import {
  actionsColumn,
  idColumn,
  nameColumn,
  OwnerCell,
  textColumn,
  timestampColumn,
} from '@/components/tables'

import {
  TemplateActionsCell,
  type TemplateRowActions,
} from './template-actions-cell'

export type TemplateColumnActions = TemplateRowActions

interface BuildTemplateColumnsOptions {
  t: (key: string) => string
  actions: TemplateColumnActions
}

export function buildTemplateColumns({
  t,
  actions,
}: BuildTemplateColumnsOptions): ColumnDef<TemplateDTO, unknown>[] {
  return [
    nameColumn<TemplateDTO>((template) => template.name, {
      header: t('objects.fields.name'),
      sortable: true,
    }),
    textColumn<TemplateDTO>(
      'type',
      t('templates.fields.type'),
      (template): ReactNode => (
        <Badge variant="secondary" className="capitalize">
          {template.type}
        </Badge>
      )
    ),
    // Who owns the template decides what can be done to it, so it earns its own column rather than
    // riding along as a badge that only appears for one of the two cases.
    textColumn<TemplateDTO>(
      'owner',
      t('common.owner'),
      (template): ReactNode => (
        <OwnerCell
          system={template.system}
          ownerUserId={template.ownerUserId}
        />
      )
    ),
    textColumn<TemplateDTO>(
      'version',
      t('objects.fields.version'),
      (template) => template.version ?? '—'
    ),
    idColumn<TemplateDTO>((template) => template.id, t('objects.fields.uuid')),
    // Sortable because the node sorts on createdAt server-side, like it does for objects.
    timestampColumn<TemplateDTO>(
      'createdAt',
      t('objects.fields.created'),
      (template) => template.createdAt,
      { sortable: true }
    ),
    actionsColumn<TemplateDTO>(
      (template): ReactNode => (
        <TemplateActionsCell template={template} actions={actions} />
      ),
      t('common.actions')
    ),
  ]
}
