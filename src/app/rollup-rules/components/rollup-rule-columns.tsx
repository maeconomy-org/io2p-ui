'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui'
import {
  EntityActionsCell,
  type EntityRowAction,
  OwnerCell,
  canWriteLibraryItem,
  actionsColumn,
  idColumn,
  nameColumn,
  selectColumn,
  textColumn,
  timestampColumn,
} from '@/components/entity-list'
import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'

import { useAuth } from '@/contexts'
import type { RollupRuleDTO } from 'io2p-client'

export interface RollupRuleColumnActions {
  onViewDetails: (rule: RollupRuleDTO) => void
  onDelete: (rule: RollupRuleDTO) => void
  onRestore: (rule: RollupRuleDTO) => void
  onRecompute: (rule: RollupRuleDTO) => void
  onEdit: (rule: RollupRuleDTO) => void
}

interface BuildRollupRuleColumnsOptions {
  t: (key: string) => string
  locale: PropertyDictionaryLocale
  actions: RollupRuleColumnActions
  /**
   * Keys the viewer owns a rule for. A built-in on one of these still EXISTS — the node stores
   * both — but it no longer computes on the viewer's own objects, so the row stands for a total
   * they will not see. It keeps computing for everyone else, which is why the mark says whose
   * objects it means. Not derived from the rows: the list is paginated and owner-filtered, so the
   * viewer's rule is often on another page, and the mark would come and go with the filter.
   */
  replacedKeys: ReadonlySet<string>
}

export function buildRollupRuleColumns({
  t,
  locale,
  actions,
  replacedKeys,
}: BuildRollupRuleColumnsOptions): ColumnDef<RollupRuleDTO, unknown>[] {
  return [
    selectColumn<RollupRuleDTO>(),
    // The rule stores only the key. The label is resolved from the dictionary for display — the
    // second argument is where a server-side label goes when the resource grows one.
    nameColumn<RollupRuleDTO>(
      (rule) => resolvePropertyLabel(rule.propertyKey, undefined, locale),
      {
        header: t('rollupRules.property'),
        getDeleted: (rule) => rule.deleted,
        deletedLabel: t('objects.deletedBadge'),
      }
    ),
    textColumn<RollupRuleDTO>(
      'propertyKey',
      t('rollupRules.propertyKey'),
      (rule): ReactNode => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">
            {rule.propertyKey}
          </span>
          {rule.system &&
            !rule.deleted &&
            replacedKeys.has(rule.propertyKey) && (
              <Badge
                variant="outline"
                className="h-5 shrink-0 font-normal"
                data-testid="rollup-rule-replaced"
              >
                {t('rollupRules.replacedByYours')}
              </Badge>
            )}
        </span>
      )
    ),
    textColumn<RollupRuleDTO>(
      'aggregation',
      t('rollupRules.aggregation'),
      (rule): ReactNode => (
        <Badge variant="secondary" className="h-5">
          {t(`rollupRules.aggregations.${rule.aggregation}`)}
        </Badge>
      )
    ),
    idColumn<RollupRuleDTO>((rule) => rule.id, t('objects.fields.uuid')),
    textColumn<RollupRuleDTO>(
      'owner',
      t('common.owner'),
      (rule): ReactNode => (
        <OwnerCell
          system={rule.system}
          ownerUserId={rule.ownerUserId}
          ownerName={rule.createdByName}
        />
      )
    ),
    timestampColumn<RollupRuleDTO>(
      'createdAt',
      t('objects.fields.created'),
      (rule) => rule.createdAt
    ),
    actionsColumn<RollupRuleDTO>(
      (rule): ReactNode => (
        <RollupRuleActionsCell rule={rule} t={t} actions={actions} />
      ),
      t('common.actions')
    ),
  ]
}

function RollupRuleActionsCell({
  rule,
  t,
  actions,
}: {
  rule: RollupRuleDTO
  t: (key: string) => string
  actions: RollupRuleColumnActions
}) {
  const { userId } = useAuth()

  return (
    <EntityActionsCell
      testIdPrefix="rollup-rule"
      onViewDetails={() => actions.onViewDetails(rule)}
      actions={rowActions(rule, t, actions, userId)}
    />
  )
}

/**
 * No Share, on any row: a rule is the node's or yours, and another account's 404s on every route.
 *
 * Edit reaches exactly ONE field, `multiplyBy`. `propertyKey` and `aggregation` remain the rule's
 * identity — every state row pins the ruleId — so changing a key is still delete-then-create, and
 * the edit sheet shows both as facts rather than inputs.
 *
 * Recompute is offered on a live rule you own. Rules converge on their own after any write to a
 * subtree and on the node's scheduled sweep, so this is the explicit path, not the only one.
 */
function rowActions(
  rule: RollupRuleDTO,
  t: (key: string) => string,
  actions: RollupRuleColumnActions,
  viewerId?: string
): EntityRowAction[] {
  // Before the lifecycle branches, not after: restoring is as much a write as deleting, and the
  // node's own rules are nobody's to touch.
  if (!canWriteLibraryItem(rule, viewerId)) return []

  if (rule.deleted) {
    return [
      {
        key: 'restore',
        label: t('common.restore'),
        icon: RotateCcw,
        onSelect: () => actions.onRestore(rule),
      },
    ]
  }

  return [
    {
      key: 'edit',
      label: t('common.edit'),
      icon: Pencil,
      onSelect: () => actions.onEdit(rule),
    },
    {
      key: 'recompute',
      label: t('rollupRules.recompute'),
      icon: RefreshCw,
      onSelect: () => actions.onRecompute(rule),
    },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      onSelect: () => actions.onDelete(rule),
    },
  ]
}
