'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Globe, Users } from 'lucide-react'

import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
} from '@/components/ui'
import { ContentSkeleton } from '@/components/skeletons'
import { useGrants } from '@/hooks/api/access'
import { useUserDirectory } from '@/hooks/api/users'
import { cn } from '@/lib/utils'

import { pivotByPerson, type PersonAccess } from '../utils/pivot-access'

/** One sweep, no paging: this view is a whole-picture answer, and paging it would fragment the pivot. */
const SWEEP_SIZE = 100

/**
 * Who can reach the signed-in user's things, and how far.
 *
 * The other two tabs are organised the way io2p stores access — by Share, and by resource. Neither
 * answers the question people actually ask first, which is about a PERSON: "what can Anna see, and
 * what can she do with it?" Answering it needs the rollup turned inside out, because a person's
 * grants are spread across one entry per resource and, within a resource, one per SOURCE.
 *
 * Read-only ON PURPOSE. Access is written where it is owned — an ad-hoc grant from the item's own
 * Share sheet, a bundled one by editing the Share. Putting controls here would offer a third place
 * to write, and half of them could not act on what they were next to.
 */
export function PeopleAccessView() {
  const t = useTranslations()
  const { useSharedByMe } = useGrants()
  const { data, isFetching } = useSharedByMe({ page: 1, size: SWEEP_SIZE })

  const items = useMemo(() => data?.data ?? [], [data])
  const people = useMemo(() => pivotByPerson(items), [items])
  const { nameOf } = useUserDirectory({ enabled: people.length > 0 })

  if (isFetching && people.length === 0) return <ContentSkeleton />

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10 text-muted-foreground/50" />}
        title={t('shares.people.emptyTitle')}
        description={t('shares.people.emptyDescription')}
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('shares.people.hint')}</p>
      {people.map((person) => (
        <PersonRow
          key={person.key}
          person={person}
          name={
            person.subject.kind === 'public'
              ? t('access.publicLabel')
              : nameOf(person.subject.userId)
          }
        />
      ))}
    </div>
  )
}

function PersonRow({ person, name }: { person: PersonAccess; name: string }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border', open && 'shadow-sm')}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
          aria-hidden="true"
        />
        {person.subject.kind === 'public' && (
          <Globe
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t('shares.people.itemCount', { count: person.entries.length })}
        </span>
        {/* The HIGHEST level held anywhere. Effective access is the union across sources and items,
            so the strongest is the honest headline — a weaker one would understate the reach. */}
        <Badge variant={person.highest} className="h-5 shrink-0">
          {t(`access.permission.${person.highest}`)}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-1.5 border-t bg-muted/10 px-3 py-2">
        {person.entries.map((entry) => (
          <div
            key={`${entry.resource.type}:${entry.resource.id}`}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Badge variant={entry.resource.type} className="h-5 shrink-0">
              {t(`shares.resourceType.${entry.resource.type}`)}
            </Badge>
            <span className="min-w-0 flex-1 truncate">
              {entry.resource.name ?? entry.resource.id}
            </span>
            {/* A share outlives the thing it points at — the projection never joins the two — so a
                deleted resource is shown rather than dropped, or the reach reads as smaller. */}
            {entry.resource.deleted && (
              <Badge
                variant="outline"
                className="h-5 shrink-0 border-destructive text-destructive"
              >
                {t('common.deleted')}
              </Badge>
            )}
            {entry.includeDescendants && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('shares.people.andBelow')}
              </span>
            )}
            <Badge variant={entry.permission} className="h-5 shrink-0">
              {t(`access.permission.${entry.permission}`)}
            </Badge>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
