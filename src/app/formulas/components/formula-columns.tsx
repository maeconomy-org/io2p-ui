'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { FormulaDTO } from 'io2p-client'
import { Copy, RotateCcw, Trash2, Share2 } from 'lucide-react'

import { Badge } from '@/components/ui'
import {
  EntityActionsCell,
  type EntityRowAction,
  OwnerCell,
  actionsColumn,
  idColumn,
  nameColumn,
  selectColumn,
  textColumn,
  timestampColumn,
} from '@/components/tables'

export interface FormulaColumnActions {
  onViewDetails: (formula: FormulaDTO) => void
  onDuplicate: (formula: FormulaDTO) => void
  /** Read-share only for library items — the node rejects any other permission. */
  onShare: (formula: FormulaDTO) => void
  onDelete: (formula: FormulaDTO) => void
  onRestore: (formula: FormulaDTO) => void
}

interface BuildFormulaColumnsOptions {
  t: (key: string) => string
  actions: FormulaColumnActions
}

export function buildFormulaColumns({
  t,
  actions,
}: BuildFormulaColumnsOptions): ColumnDef<FormulaDTO, unknown>[] {
  return [
    selectColumn<FormulaDTO>(),
    nameColumn<FormulaDTO>((f) => f.name, {
      header: t('objects.fields.name'),
      sortable: true,
      getDeleted: (f) => f.deleted,
      deletedLabel: t('objects.deletedBadge'),
    }),
    textColumn<FormulaDTO>(
      'expression',
      t('formulas.expression'),
      (f): ReactNode => (
        <code className="font-mono text-xs">{f.expression}</code>
      )
    ),
    // The variables ARE the contract a binding has to satisfy, and they are server-derived — so this
    // is the column that tells you what using this formula will ask of you.
    textColumn<FormulaDTO>(
      'variables',
      t('formulas.variables'),
      (f): ReactNode =>
        f.variables.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {f.variables.map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="h-5 px-1.5 font-mono text-[10px]"
              >
                {v}
              </Badge>
            ))}
          </span>
        )
    ),
    textColumn<FormulaDTO>(
      'owner',
      t('common.owner'),
      (f): ReactNode => (
        <OwnerCell system={f.system} ownerUserId={f.ownerUserId} />
      )
    ),
    idColumn<FormulaDTO>((f) => f.id, t('objects.fields.uuid')),
    timestampColumn<FormulaDTO>(
      'createdAt',
      t('objects.fields.created'),
      (f) => f.createdAt,
      { sortable: true }
    ),
    actionsColumn<FormulaDTO>(
      (f): ReactNode => (
        <EntityActionsCell
          testIdPrefix="formula"
          onViewDetails={() => actions.onViewDetails(f)}
          actions={rowActions(f, t, actions)}
        />
      ),
      t('common.actions')
    ),
  ]
}

/**
 * There is no Edit, on purpose.
 *
 * A formula is immutable: io2p has no update, and "editing" one is a NEW create recording
 * `copiedFrom` (D46) — so every value already bound to the original keeps using it. An Edit button
 * would name something the API cannot do and quietly leave existing objects on the old formula.
 * Duplicate says what actually happens.
 *
 * A built-in belongs to the node, so it can be copied but not deleted.
 */
function rowActions(
  formula: FormulaDTO,
  t: (key: string) => string,
  actions: FormulaColumnActions
): EntityRowAction[] {
  if (formula.deleted) {
    return [
      {
        key: 'restore',
        label: t('common.restore'),
        icon: RotateCcw,
        onSelect: () => actions.onRestore(formula),
      },
    ]
  }

  const rows: EntityRowAction[] = [
    {
      key: 'duplicate',
      label: t('formulas.duplicate'),
      icon: Copy,
      onSelect: () => actions.onDuplicate(formula),
    },
  ]

  if (!formula.system) {
    rows.push({
      key: 'share',
      label: t('access.share'),
      icon: Share2,
      onSelect: () => actions.onShare(formula),
    })
    rows.push({
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => actions.onDelete(formula),
    })
  }

  return rows
}
