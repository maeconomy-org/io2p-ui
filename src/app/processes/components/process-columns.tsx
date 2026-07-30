'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ProcessListItem } from 'io2p-client'
import { ArrowRight, Pencil, RotateCcw, Share2, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui'
import {
  EntityActionsCell,
  type EntityRowAction,
  actionsColumn,
  idColumn,
  nameColumn,
  selectColumn,
  textColumn,
  timestampColumn,
} from '@/components/tables'

export interface ProcessColumnActions {
  onViewDetails: (process: ProcessListItem) => void
  onEdit: (process: ProcessListItem) => void
  onShare: (process: ProcessListItem) => void
  onDelete: (process: ProcessListItem) => void
  onRestore: (process: ProcessListItem) => void
}

interface BuildProcessColumnsOptions {
  t: (key: string) => string
  actions: ProcessColumnActions
  /** Sharing is owner-only — the node 403s a non-owner reading the grant list. */
  currentUserId?: string
}

export function buildProcessColumns({
  t,
  actions,
  currentUserId,
}: BuildProcessColumnsOptions): ColumnDef<ProcessListItem, unknown>[] {
  return [
    selectColumn<ProcessListItem>(),
    nameColumn<ProcessListItem>((p) => p.name, {
      header: t('objects.fields.name'),
      sortable: true,
      getDeleted: (p) => p.deleted,
      deletedLabel: t('objects.deletedBadge'),
    }),
    // The in→out shape is what distinguishes one process from another at a glance, and it is the
    // only thing the list can show about flows without fetching each aggregate.
    textColumn<ProcessListItem>(
      'flows',
      t('processes.fields.flows'),
      (p): ReactNode => (
        <span className="flex items-center gap-1.5 text-sm">
          <Badge variant="secondary" className="h-5 px-1.5">
            {p.inputs?.length ?? 0}
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="secondary" className="h-5 px-1.5">
            {p.outputs?.length ?? 0}
          </Badge>
        </span>
      )
    ),
    idColumn<ProcessListItem>((p) => p.id, t('objects.fields.uuid')),
    timestampColumn<ProcessListItem>(
      'createdAt',
      t('objects.fields.created'),
      (p) => p.createdAt,
      { sortable: true }
    ),
    actionsColumn<ProcessListItem>(
      (p): ReactNode => (
        <EntityActionsCell
          testIdPrefix="process"
          onViewDetails={() => actions.onViewDetails(p)}
          actions={rowActions(p, t, actions, currentUserId)}
        />
      ),
      t('common.actions')
    ),
  ]
}

// A deleted process can only be restored — editing or re-deleting it would be rejected anyway.
function rowActions(
  process: ProcessListItem,
  t: (key: string) => string,
  actions: ProcessColumnActions,
  currentUserId?: string
): EntityRowAction[] {
  if (process.deleted) {
    return [
      {
        key: 'restore',
        label: t('common.restore'),
        icon: RotateCcw,
        onSelect: () => actions.onRestore(process),
      },
    ]
  }
  return [
    {
      key: 'edit',
      label: t('common.edit'),
      icon: Pencil,
      onSelect: () => actions.onEdit(process),
    },
    ...(process.createdBy === currentUserId
      ? [
          {
            key: 'share',
            label: t('access.share'),
            icon: Share2,
            onSelect: () => actions.onShare(process),
          },
        ]
      : []),
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => actions.onDelete(process),
    },
  ]
}
