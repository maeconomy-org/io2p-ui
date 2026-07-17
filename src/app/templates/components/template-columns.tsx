'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { TemplateDTO } from 'io2p-client'
import { Pencil, Trash2 } from 'lucide-react'

import { Badge, Button } from '@/components/ui'
import {
  actionsColumn,
  idColumn,
  nameColumn,
  textColumn,
} from '@/components/tables'

export interface TemplateColumnActions {
  onEdit: (template: TemplateDTO) => void
  onDelete: (template: TemplateDTO) => void
}

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
      t('models.fields.type'),
      (template): ReactNode => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {template.type}
          </Badge>
          {template.system && (
            <Badge variant="outline">{t('models.systemBadge')}</Badge>
          )}
        </div>
      )
    ),
    textColumn<TemplateDTO>(
      'version',
      t('objects.fields.version'),
      (template) => template.version ?? '—'
    ),
    idColumn<TemplateDTO>((template) => template.id, t('objects.fields.uuid')),
    actionsColumn<TemplateDTO>(
      (template): ReactNode => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('common.edit')}
            onClick={() => actions.onEdit(template)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!template.system && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('common.delete')}
              onClick={() => actions.onDelete(template)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      t('common.actions')
    ),
  ]
}
