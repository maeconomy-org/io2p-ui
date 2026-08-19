'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { RotateCcw, Trash2 } from 'lucide-react'

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
}

interface BuildRollupRuleColumnsOptions {
  t: (key: string) => string
  locale: PropertyDictionaryLocale
  actions: RollupRuleColumnActions
}

export function buildRollupRuleColumns({
  t,
  locale,
  actions,
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
        <span className="font-mono text-xs text-muted-foreground">
          {rule.propertyKey}
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
 * No Edit and no Share, on any row.
 *
 * PATCH updates no field in v1 and `propertyKey` is the rule's identity — every state row pins the
 * ruleId — so changing a key is delete-then-create. Sharing does not exist for this resource: a
 * rule is the node's or yours, and another account's 404s on every route.
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
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      onSelect: () => actions.onDelete(rule),
    },
  ]
}
