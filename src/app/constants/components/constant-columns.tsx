'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ConstantDTO } from 'io2p-client'
import { AlertCircle, Pencil, RotateCcw, Share2, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui'
import {
  EntityActionsCell,
  type EntityRowAction,
  OwnerCell,
  actionsColumn,
  canWriteLibraryItem,
  idColumn,
  nameColumn,
  selectColumn,
  textColumn,
  timestampColumn,
} from '@/components/entity-list'
import { useAuth } from '@/contexts'

export interface ConstantColumnActions {
  onViewDetails: (constant: ConstantDTO) => void
  /** Read-share only for library items — the node rejects any other permission. */
  onShare: (constant: ConstantDTO) => void
  onDelete: (constant: ConstantDTO) => void
  onRestore: (constant: ConstantDTO) => void
}

interface BuildConstantColumnsOptions {
  t: (key: string) => string
  actions: ConstantColumnActions
}

export function buildConstantColumns({
  t,
  actions,
}: BuildConstantColumnsOptions): ColumnDef<ConstantDTO, unknown>[] {
  return [
    selectColumn<ConstantDTO>(),
    nameColumn<ConstantDTO>((c) => c.name, {
      header: t('constants.name'),
      sortable: true,
      getDeleted: (c) => c.deleted,
      deletedLabel: t('objects.deletedBadge'),
    }),
    // The CURRENT value — the last version. Anything bound before it keeps its own.
    textColumn<ConstantDTO>(
      'value',
      t('constants.currentValue'),
      (c): ReactNode => {
        const current = c.versions.at(-1)
        if (!current) return <span className="text-muted-foreground">—</span>
        return (
          <span className="flex items-baseline gap-2">
            <span className="font-medium">{current.data}</span>
            {/* A value that did not normalize can never feed a calc. */}
            {current.parse?.ok === false && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {t('constants.notNumeric')}
              </span>
            )}
          </span>
        )
      }
    ),
    textColumn<ConstantDTO>(
      'versions',
      t('constants.versions'),
      (c): ReactNode => (
        <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
          {c.versions.length}
        </Badge>
      )
    ),
    idColumn<ConstantDTO>((c) => c.id, t('objects.fields.uuid')),
    textColumn<ConstantDTO>(
      'owner',
      t('common.owner'),
      (c): ReactNode => (
        <OwnerCell
          system={c.system}
          ownerUserId={c.ownerUserId}
          ownerName={c.ownerName}
        />
      )
    ),
    timestampColumn<ConstantDTO>(
      'createdAt',
      t('objects.fields.created'),
      // A constant has no own timestamps; version 1 is when it came into being.
      (c) => c.versions[0]?.ts,
      { sortable: true }
    ),
    actionsColumn<ConstantDTO>(
      (c): ReactNode => (
        <ConstantActionsCell constant={c} t={t} actions={actions} />
      ),
      t('common.actions')
    ),
  ]
}

/** A component, so the viewer's id comes from the auth context — as it does in `OwnerCell`. */
function ConstantActionsCell({
  constant,
  t,
  actions,
}: {
  constant: ConstantDTO
  t: (key: string) => string
  actions: ConstantColumnActions
}) {
  const { userId } = useAuth()
  const canWrite = canWriteLibraryItem(constant, userId)

  return (
    <EntityActionsCell
      testIdPrefix="constant"
      onViewDetails={() => actions.onViewDetails(constant)}
      actions={rowActions(constant, t, actions, canWrite)}
      // A built-in already drops the menu entirely; only a shared row needs to say why it is bare.
      emptyMenuLabel={
        !canWrite && !constant.system ? t('common.sharedReadOnly') : undefined
      }
    />
  )
}

/**
 * "Edit" opens the same sheet as Details, because editing a constant is APPENDING a version — the
 * sheet has to show the history for that to make sense. A built-in belongs to the node and one
 * shared with you is shared read-only, so both can be read but not changed or deleted.
 */
function rowActions(
  constant: ConstantDTO,
  t: (key: string) => string,
  actions: ConstantColumnActions,
  canWrite: boolean
): EntityRowAction[] {
  if (!canWrite) return []

  if (constant.deleted) {
    return [
      {
        key: 'restore',
        label: t('common.restore'),
        icon: RotateCcw,
        onSelect: () => actions.onRestore(constant),
      },
    ]
  }

  return [
    {
      key: 'edit',
      label: t('constants.addVersion'),
      icon: Pencil,
      onSelect: () => actions.onViewDetails(constant),
    },
    {
      key: 'share',
      label: t('access.share'),
      icon: Share2,
      onSelect: () => actions.onShare(constant),
    },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => actions.onDelete(constant),
    },
  ]
}
