'use client'

import { useTranslations } from 'next-intl'
import { Pencil, RotateCcw, Trash2, Share2 } from 'lucide-react'
import type { TemplateListItem } from 'io2p-client'

import { EntityActionsCell, type EntityRowAction } from '@/components/tables'

export interface TemplateRowActions {
  onViewDetails: (template: TemplateListItem) => void
  onEdit: (template: TemplateListItem) => void
  /** Read-share only — the node rejects any other permission on a template. */
  onShare: (template: TemplateListItem) => void
  onDelete: (template: TemplateListItem) => void
  onRestore: (template: TemplateListItem) => void
}

/**
 * Row actions for the templates table.
 *
 * System templates belong to the node, so they offer nothing but Details — the write actions are
 * omitted rather than shown disabled, since the server rejects them with a 403 anyway.
 */
export function TemplateActionsCell({
  template,
  actions,
}: {
  template: TemplateListItem
  actions: TemplateRowActions
}) {
  const t = useTranslations()
  const isDeleted = !!template.deleted
  const canWrite = !template.system

  const rowActions: EntityRowAction[] = []
  if (canWrite && isDeleted) {
    rowActions.push({
      key: 'restore',
      label: t('common.restore'),
      icon: RotateCcw,
      onSelect: () => actions.onRestore(template),
    })
  } else if (canWrite) {
    rowActions.push(
      {
        key: 'edit',
        label: t('common.edit'),
        icon: Pencil,
        onSelect: () => actions.onEdit(template),
      },
      {
        key: 'share',
        label: t('access.share'),
        icon: Share2,
        onSelect: () => actions.onShare(template),
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        destructive: true,
        separated: true,
        onSelect: () => actions.onDelete(template),
      }
    )
  }

  return (
    <EntityActionsCell
      testIdPrefix="template"
      onViewDetails={() => actions.onViewDetails(template)}
      actions={rowActions}
      emptyMenuLabel={t('templates.systemReadOnly')}
    />
  )
}
