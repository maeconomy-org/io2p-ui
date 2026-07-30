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
} from '@/components/tables'

type Grant = SharedByMeItem['grants'][number]

function ResourceLabel({ name, id }: { name: string | null; id: string }) {
  if (name) return <span className="truncate">{name}</span>
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {id.split('-')[0]}
    </span>
  )
}

/** Only object and process can be managed here — `GET /v1/access` refuses the library types. */
function isManageable(type: SharedByMeItem['resource']['type']) {
  return type === 'object' || type === 'process'
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
  nameOf,
  resourceNameOf,
  resourceDeleted,
  onManage,
  onRevokeAll,
}: {
  t: (key: string, values?: Record<string, string | number>) => string
  nameOf: (userId: string) => string
  /** Null when the cached directory page did not hold this resource. */
  resourceNameOf: (type: string, id: string) => string | null
  resourceDeleted: (type: string, id: string) => boolean
  onManage: (item: SharedByMeItem) => void
  onRevokeAll: (item: SharedByMeItem) => void
}): ColumnDef<SharedByMeItem, unknown>[] {
  const labelFor = (grant: Grant) =>
    grant.subject.kind === 'public'
      ? t('shares.everyone')
      : nameOf(grant.subject.userId)

  return [
    selectColumn<SharedByMeItem>(),
    textColumn<SharedByMeItem>(
      'resource',
      t('shares.fields.resource'),
      (item): ReactNode => (
        <span className="flex items-center gap-2">
          <Badge variant="outline" className="h-5 shrink-0">
            {t(`shares.resourceType.${item.resource.type}`)}
          </Badge>
          {/* The rollup returns `{type, id}` with no name, so the label comes from the cached
              object/process directory — two list reads for the page, never one per row. Beyond that
              page it falls back to the id's leading segment: enough to tell two rows apart. */}
          <ResourceLabel
            name={resourceNameOf(item.resource.type, item.resource.id)}
            id={item.resource.id}
          />
          {/* A share outlives the thing it points at — the grants stay active on a soft-deleted
              resource — so the row has to say so or it reads as live access to a live object. */}
          {resourceDeleted(item.resource.type, item.resource.id) && (
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
        return (
          <Badge variant="secondary" className="h-5">
            {levels.size > 1
              ? t('shares.mixedPermissions')
              : t(`access.permission.${item.grants[0].permission}`)}
          </Badge>
        )
      }
    ),
    // The same primary-button-plus-dropdown every other table uses. A bare icon button here read as
    // a different kind of row than it is.
    actionsColumn<SharedByMeItem>((item): ReactNode => {
      const manageable = isManageable(item.resource.type)
      return (
        <EntityActionsCell
          testIdPrefix="shared-by-me"
          detailsLabel={t('shares.manageAccess')}
          onViewDetails={() => manageable && onManage(item)}
          emptyMenuLabel={manageable ? undefined : t('shares.notManageable')}
          actions={
            manageable
              ? [
                  {
                    key: 'revoke-all',
                    label: t('shares.revokeAll'),
                    icon: Ban,
                    destructive: true,
                    separated: true,
                    onSelect: () => onRevokeAll(item),
                  },
                ]
              : []
          }
        />
      )
    }, t('common.actions')),
  ]
}
