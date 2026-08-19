'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { FormulaDTO } from 'io2p-client'
import { AlertTriangle, Copy, RotateCcw, Trash2, Share2 } from 'lucide-react'

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

export interface FormulaColumnActions {
  onViewDetails: (formula: FormulaDTO) => void
  onDuplicate: (formula: FormulaDTO) => void
  onCorrect: (formula: FormulaDTO) => void
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
    // What the result is IN. Blank means the node infers it from the arguments, which is the
    // common case — a declaration is for expressions inference cannot follow.
    textColumn<FormulaDTO>(
      'unit',
      t('formulas.unit'),
      (f): ReactNode =>
        f.unit ? (
          <code className="font-mono text-xs">{f.unit}</code>
        ) : (
          <span className="text-muted-foreground">—</span>
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
    idColumn<FormulaDTO>((f) => f.id, t('objects.fields.uuid')),
    textColumn<FormulaDTO>(
      'owner',
      t('common.owner'),
      (f): ReactNode => (
        <OwnerCell
          system={f.system}
          ownerUserId={f.ownerUserId}
          ownerName={f.ownerName}
        />
      )
    ),
    timestampColumn<FormulaDTO>(
      'createdAt',
      t('objects.fields.created'),
      (f) => f.createdAt,
      { sortable: true }
    ),
    actionsColumn<FormulaDTO>(
      (f): ReactNode => (
        <FormulaActionsCell formula={f} t={t} actions={actions} />
      ),
      t('common.actions')
    ),
  ]
}

/**
 * A component rather than a call to `rowActions`, so the viewer's id can come from the auth context
 * the way `OwnerCell` takes it — the builder is called once per page and would otherwise have to
 * thread an id that every row already has a hook for.
 */
function FormulaActionsCell({
  formula,
  t,
  actions,
}: {
  formula: FormulaDTO
  t: (key: string) => string
  actions: FormulaColumnActions
}) {
  const { userId } = useAuth()

  return (
    <EntityActionsCell
      testIdPrefix="formula"
      onViewDetails={() => actions.onViewDetails(formula)}
      actions={rowActions(
        formula,
        t,
        actions,
        canWriteLibraryItem(formula, userId)
      )}
    />
  )
}

/**
 * There is no Edit, on purpose.
 *
 * A formula is immutable: io2p has no update, and "editing" one is a NEW create recording
 * `copiedFrom` (D46) — so every value already bound to the original keeps using it. An Edit button
 * would name something the API cannot do and quietly leave existing objects on the old formula.
 * Duplicate says what actually happens.
 *
 * A built-in belongs to the node, and one shared with you is shared read-only — either way it can be
 * copied but not deleted. Duplicate stays on offer in both cases, because the copy is YOURS.
 */
function rowActions(
  formula: FormulaDTO,
  t: (key: string) => string,
  actions: FormulaColumnActions,
  canWrite: boolean
): EntityRowAction[] {
  if (formula.deleted) {
    return canWrite
      ? [
          {
            key: 'restore',
            label: t('common.restore'),
            icon: RotateCcw,
            onSelect: () => actions.onRestore(formula),
          },
        ]
      : []
  }

  const rows: EntityRowAction[] = [
    {
      key: 'duplicate',
      label: t('formulas.duplicate'),
      icon: Copy,
      onSelect: () => actions.onDuplicate(formula),
    },
  ]

  if (canWrite) {
    // Not offered on an already-superseded formula: the pointer is last-write-wins, so a second
    // correction would silently drop the first one and leave two claims with no way to see either.
    if (!formula.system && !formula.supersededBy) {
      rows.push({
        key: 'correct',
        label: t('formulas.correct'),
        icon: AlertTriangle,
        onSelect: () => actions.onCorrect(formula),
      })
    }
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
