'use client'

import { useTranslations } from 'next-intl'
import { Pencil, RotateCcw, Trash2, Share2 } from 'lucide-react'
import type { TemplateListItem } from 'io2p-client'

import {
  EntityActionsCell,
  canWriteLibraryItem,
  type EntityRowAction,
} from '@/components/entity-list'
import { useAuth } from '@/contexts'

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
 * A template the viewer does not own offers nothing but Details — the write actions are omitted
 * rather than shown disabled, since the server rejects them with a 403 anyway. That covers two
 * cases: a system template, which belongs to the node, and one SHARED with the viewer, which is
 * shared read-only because the node accepts no other permission on a template.
 */
export function TemplateActionsCell({
  template,
  actions,
}: {
  template: TemplateListItem
  actions: TemplateRowActions
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  const isDeleted = !!template.deleted
  const canWrite = canWriteLibraryItem(template, userId)

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
      emptyMenuLabel={
        template.system
          ? t('templates.systemReadOnly')
          : t('common.sharedReadOnly')
      }
    />
  )
}
