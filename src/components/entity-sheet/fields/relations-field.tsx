'use client'

import type { ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from 'lucide-react'

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Skeleton,
} from '@/components/ui'
import { OwnerHint } from '@/components/entity-list'

import {
  useObjectRelations,
  type ProcessRelation,
  type RelationGroup,
} from '../hooks/use-object-relations'

/**
 * The processes that consume or produce this object.
 *
 * Read-only, and deliberately so: a flow belongs to the PROCESS, so editing one from here would be
 * writing to a different entity than the sheet is holding — with its own dirty state, its own
 * concurrency token and no way to include it in this sheet's Save.
 *
 * Individual rows do not link out either — `ParentsField` sets the precedent that a sheet shows
 * names rather than navigating away from the entity being edited. The ONE way out is `onViewAll`,
 * which hands the whole question to `/processes`, where the graph views can answer it properly.
 */
export function RelationsField({
  entityId,
  onViewAll,
}: {
  entityId?: string
  /** Leave for `/processes` filtered to this object. Omit to render no way out. */
  onViewAll?: () => void
}) {
  const t = useTranslations()
  const { consumedBy, producedBy, isLoading, error } =
    useObjectRelations(entityId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('objects.relations.loadFailed')}</AlertDescription>
      </Alert>
    )
  }

  const empty =
    (consumedBy?.relations.length ?? 0) === 0 &&
    (producedBy?.relations.length ?? 0) === 0

  if (empty) {
    return (
      <p
        data-testid="relations-empty"
        className="text-sm text-muted-foreground"
      >
        {t('objects.relations.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {onViewAll && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          data-testid="relations-view-all"
          onClick={onViewAll}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t('objects.relations.viewAll')}
        </Button>
      )}

      <RelationList
        testId="consumed-by"
        title={t('objects.relations.consumedBy')}
        hint={t('objects.relations.consumedByHint')}
        icon={
          <ArrowDownToLine
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        }
        group={consumedBy}
      />
      <RelationList
        testId="produced-by"
        title={t('objects.relations.producedBy')}
        hint={t('objects.relations.producedByHint')}
        icon={
          <ArrowUpFromLine
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        }
        group={producedBy}
      />
    </div>
  )
}

function RelationList({
  testId,
  title,
  hint,
  icon,
  group,
}: {
  testId: string
  title: string
  hint: string
  icon: ReactNode
  group?: RelationGroup
}) {
  const t = useTranslations()

  if (!group || group.relations.length === 0) return null

  // Only the first page is fetched. Say so rather than presenting a truncated list as the whole
  // answer — a relation count that quietly stops at 25 reads as "that is all of them".
  const hidden = group.total - group.relations.length

  return (
    <section className="space-y-2" data-testid={`relations-${testId}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{title}</span>
        <Badge
          variant="secondary"
          data-testid={`relations-${testId}-count`}
          className="h-5 px-1.5"
        >
          {group.total}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>

      <div className="space-y-1.5">
        {group.relations.map((relation) => (
          <RelationRow
            key={relation.process.id}
            testId={`relation-${relation.process.id}`}
            relation={relation}
          />
        ))}
      </div>

      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('objects.relations.more', { count: hidden })}
        </p>
      )}
    </section>
  )
}

function RelationRow({
  testId,
  relation,
}: {
  testId: string
  relation: ProcessRelation
}) {
  const t = useTranslations()
  const format = useFormatter()
  const { process, flows } = relation

  // One process can reference the same object in several flows on the same side, so the quantities
  // are joined rather than showing only the first — which would silently report a fraction.
  const quantities = flows.map((f) => f.quantity).filter(Boolean)

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {process.name}
          <OwnerHint
            ownerUserId={process.createdBy}
            ownerName={process.createdByName}
          />
        </p>
        <p className="text-xs text-muted-foreground">
          {format.dateTime(new Date(process.createdAt), {
            dateStyle: 'medium',
          })}
          {flows.length > 1 && (
            <>
              {' · '}
              {t('objects.relations.flowCount', { count: flows.length })}
            </>
          )}
        </p>
      </div>
      <span
        data-testid="relation-quantity"
        className="shrink-0 text-sm text-muted-foreground"
      >
        {quantities.length > 0 ? quantities.join(', ') : '—'}
      </span>
    </div>
  )
}
