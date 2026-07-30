'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ShareDTO } from 'io2p-client'
import { Boxes, Pencil, Trash2, Users } from 'lucide-react'

import { Badge } from '@/components/ui'
import {
  EntityActionsCell,
  type EntityRowAction,
  actionsColumn,
  nameColumn,
  textColumn,
  timestampColumn,
} from '@/components/tables'

export interface ShareColumnActions {
  onEdit: (share: ShareDTO) => void
  onDelete: (share: ShareDTO) => void
}

export function buildShareColumns({
  t,
  actions,
}: {
  t: (key: string) => string
  actions: ShareColumnActions
}): ColumnDef<ShareDTO, unknown>[] {
  return [
    nameColumn<ShareDTO>((s) => s.name, {
      header: t('shares.fields.name'),
      sortable: true,
      getDeleted: (s) => s.deleted,
      deletedLabel: t('objects.deletedBadge'),
    }),
    // Counts rather than names: a bundle exists to be big, and listing twelve objects in a cell
    // would push the columns that identify it off screen.
    textColumn<ShareDTO>(
      'contents',
      t('shares.fields.contents'),
      (s): ReactNode => (
        <span className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="secondary" className="h-5 px-1.5">
              {s.resources?.length ?? 0}
            </Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="secondary" className="h-5 px-1.5">
              {s.members?.length ?? 0}
            </Badge>
          </span>
        </span>
      )
    ),
    textColumn<ShareDTO>(
      'cascade',
      t('shares.fields.cascade'),
      (s): ReactNode =>
        s.includeDescendants ? (
          <Badge variant="outline" className="h-5">
            {t('shares.cascadeOn')}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
    ),
    timestampColumn<ShareDTO>(
      'updatedAt',
      t('shares.fields.updated'),
      (s) => s.updatedAt,
      { sortable: true }
    ),
    actionsColumn<ShareDTO>(
      (s): ReactNode => (
        <EntityActionsCell
          testIdPrefix="share"
          onViewDetails={() => !s.deleted && actions.onEdit(s)}
          actions={rowActions(s, t, actions)}
          emptyMenuLabel={s.deleted ? t('shares.deletedNoRestore') : undefined}
        />
      ),
      t('common.actions')
    ),
  ]
}

function rowActions(
  share: ShareDTO,
  t: (key: string) => string,
  actions: ShareColumnActions
): EntityRowAction[] {
  // A deleted share offers nothing. Every other entity would offer Restore here, but `SharesApi`
  // has no restore — the bundle is soft-deleted (the DELETE returns a `deleted: true` DTO) and
  // then unreachable. Editing or re-deleting it would be rejected anyway.
  if (share.deleted) return []

  return [
    {
      key: 'edit',
      label: t('common.edit'),
      icon: Pencil,
      onSelect: () => actions.onEdit(share),
    },
    {
      key: 'delete',
      // Not "delete" in the user's head: removing the bundle revokes every grant it owns, so
      // people lose access to things this row never named.
      label: t('shares.deleteAction'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => actions.onDelete(share),
    },
  ]
}
