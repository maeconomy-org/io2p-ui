'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { SharedByMeItem } from 'io2p-client'
import { Ban, Users } from 'lucide-react'

import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import {
  EntityActionsCell,
  actionsColumn,
  selectColumn,
  textColumn,
} from '@/components/entity-list'

type Grant = SharedByMeItem['grants'][number]

/** `name` is absent only when the resource no longer exists, so the id is the honest label. */
function ResourceLabel({ name, id }: { name?: string; id: string }) {
  if (name) return <span className="truncate">{name}</span>
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {id.split('-')[0]}
    </span>
  )
}

/**
 * One row per RESOURCE, and the row is a SUMMARY — it does not manage access.
 *
 * The previous version put a revoke button per grant in the cell, which meant a resource shared with
 * three people showed three `×` icons, each of which removed someone's access instantly and without
 * confirmation. Revocation is not a "close" gesture. Managing access opens the same Share sheet an
 * entity's own row opens, where changes stage and you press Save.
 */
export function buildSharedByMeColumns({
  t,
  onManage,
  onRevokeAll,
}: {
  t: (key: string, values?: Record<string, string | number>) => string
  onManage: (item: SharedByMeItem) => void
  onRevokeAll: (item: SharedByMeItem) => void
}): ColumnDef<SharedByMeItem, unknown>[] {
  // The node resolves the grantee's name on the row. Absent means unresolved, not blank — the id
  // keeps an unresolvable grantee visible instead of rendering an empty cell that reads as nobody.
  const labelFor = (grant: Grant) =>
    grant.subject.kind === 'public'
      ? t('shares.everyone')
      : (grant.subject.name ?? grant.subject.userId)

  return [
    selectColumn<SharedByMeItem>(),
    textColumn<SharedByMeItem>(
      'resource',
      t('shares.fields.resource'),
      (item): ReactNode => (
        <span className="flex items-center gap-2">
          <Badge variant={item.resource.type} className="h-5 shrink-0">
            {t(`shares.resourceType.${item.resource.type}`)}
          </Badge>
          {/* The rollup returns `{type, id}` with no name, so the label comes from the cached
              object/process directory — two list reads for the page, never one per row. Beyond that
              page it falls back to the id's leading segment: enough to tell two rows apart. */}
          <ResourceLabel name={item.resource.name} id={item.resource.id} />
          {/* A share outlives the thing it points at — the grants stay active on a soft-deleted
              resource — so the row has to say so or it reads as live access to a live object. */}
          {item.resource.deleted && (
            <Badge variant="outline" className="h-5 shrink-0">
              {t('objects.deletedBadge')}
            </Badge>
          )}
        </span>
      )
    ),
    textColumn<SharedByMeItem>(
      'sharedWith',
      t('shares.fields.sharedWith'),
      (item): ReactNode => {
        if (item.grants.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        // A count, like the Contents column on the Shares tab. Names vary wildly in length, so
        // showing one made every row a different shape while still hiding the others.
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="h-5 px-1.5">
                    {item.grants.length}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent align="start">
                <ul className="space-y-0.5">
                  {item.grants.map((grant) => (
                    <li key={labelFor(grant)}>
                      {labelFor(grant)} ·{' '}
                      {t(`access.permission.${grant.permission}`)}
                      {grant.includeDescendants
                        ? ` · ${t('shares.cascadeOn')}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
    ),
    textColumn<SharedByMeItem>(
      'permission',
      t('shares.fields.permission'),
      (item): ReactNode => {
        const levels = new Set(item.grants.map((g) => g.permission))
        if (levels.size === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        // Always a badge, never bare text. A column that is text on most rows and a badge on the
        // odd one reads as two different kinds of value rather than one.
        //
        // Different people can sit at different rungs on the same resource, and picking one would
        // misreport the others — "Mixed" says look inside. The cascade flag lives in the
        // Shared-with tooltip, since it is per person and this column is per row.
        // Mixed stays NEUTRAL rather than borrowing one rung's colour — the ramp means "this is
        // the level", and colouring a row that has several would assert a level nobody holds.
        // `outline`, not `secondary`: a filled neutral sits at the same lightness as the `read`
        // rung, so in THIS column — the only place both appear — a flat chip would read as a level.
        return levels.size > 1 ? (
          <Badge variant="outline" className="h-5">
            {t('shares.mixedPermissions')}
          </Badge>
        ) : (
          <Badge variant={item.grants[0].permission} className="h-5">
            {t(`access.permission.${item.grants[0].permission}`)}
          </Badge>
        )
      }
    ),
    // The same primary-button-plus-dropdown every other table uses. A bare icon button here read as
    // a different kind of row than it is.
    actionsColumn<SharedByMeItem>(
      (item): ReactNode => (
        <EntityActionsCell
          testIdPrefix="shared-by-me"
          detailsLabel={t('shares.manageAccess')}
          onViewDetails={() => onManage(item)}
          actions={[
            {
              key: 'revoke-all',
              label: t('shares.revokeAll'),
              icon: Ban,
              destructive: true,
              separated: true,
              onSelect: () => onRevokeAll(item),
            },
          ]}
        />
      ),
      t('common.actions')
    ),
  ]
}
