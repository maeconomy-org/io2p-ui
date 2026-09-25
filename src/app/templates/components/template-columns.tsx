'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { TemplateListItem } from 'io2p-client'

import { Badge } from '@/components/ui'
import {
  actionsColumn,
  idColumn,
  nameColumn,
  selectColumn,
  OwnerCell,
  textColumn,
  timestampColumn,
} from '@/components/entity-list'

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
}: BuildTemplateColumnsOptions): ColumnDef<TemplateListItem, unknown>[] {
  return [
    selectColumn<TemplateListItem>(),
    nameColumn<TemplateListItem>((template) => template.name, {
      header: t('objects.fields.name'),
      sortable: true,
    }),
    textColumn<TemplateListItem>(
      'type',
      t('templates.fields.type'),
      (template): ReactNode => (
        <Badge variant={template.type} className="capitalize">
          {template.type}
        </Badge>
      )
    ),
    textColumn<TemplateListItem>(
      'version',
      t('objects.fields.version'),
      (template) => template.version ?? '—'
    ),
    idColumn<TemplateListItem>(
      (template) => template.id,
      t('objects.fields.uuid')
    ),
    // Who owns the template decides what can be done to it, so it earns its own column rather than
    // riding along as a badge that only appears for one of the two cases.
    textColumn<TemplateListItem>(
      'owner',
      t('common.owner'),
      (template): ReactNode => (
        <OwnerCell
          system={template.system}
          ownerUserId={template.ownerUserId}
          ownerName={template.ownerName}
        />
      )
    ),
    // Sortable because the node sorts on createdAt server-side, like it does for objects.
    timestampColumn<TemplateListItem>(
      'createdAt',
      t('objects.fields.created'),
      (template) => template.createdAt,
      { sortable: true }
    ),
    actionsColumn<TemplateListItem>(
      (template): ReactNode => (
        <TemplateActionsCell template={template} actions={actions} />
      ),
      t('common.actions')
    ),
  ]
}
