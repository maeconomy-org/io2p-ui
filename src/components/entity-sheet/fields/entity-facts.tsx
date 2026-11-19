'use client'

import type { ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import { Badge, CopyButton } from '@/components/ui'

/**
 * The lifecycle fields every io2p entity carries. Typed structurally rather than as `ObjectDTO` so
 * objects, templates and processes share one implementation — they genuinely have the same facts.
 */
export interface EntityFactsShape {
  id: string
  currentVersion: number
  createdAt: number
  updatedAt: number
  createdBy?: string
  /** Resolved by the node on read, so a rename shows immediately. Absent = unresolved, not blank. */
  createdByName?: string
  deleted?: boolean
  deletedAt?: number
  deletedBy?: string
  deletedByName?: string
}

/**
 * Server-owned facts about a saved entity: identity, authorship, and lifecycle. Read-only by
 * definition — nothing here is authored, so it sits apart from the editable fields rather than
 * among them.
 */
export function EntityFacts({ entity }: { entity: EntityFactsShape }) {
  const t = useTranslations()
  const format = useFormatter()

  const at = (epochMs: number) =>
    format.dateTime(new Date(epochMs), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  return (
    <dl className="space-y-3 rounded-md border bg-muted/20 p-3">
      <Fact label={t('objects.fields.uuid')}>
        <span className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {entity.id}
          </code>
          <CopyButton
            text={entity.id}
            label={t('objects.fields.uuid')}
            className="shrink-0"
          />
        </span>
      </Fact>

      {/* Labelled "revision", not "version", on purpose: this is the server's write counter and the
          if-match token every save uses (a jump means someone else wrote in between). A template
          also carries an AUTHORED `version` label right below these facts, and calling both
          "Version" made one field look like two readings of the same thing. */}
      <Fact label={t('objects.fields.revision')}>{entity.currentVersion}</Fact>

      <Fact label={t('objects.fields.created')}>
        {at(entity.createdAt)}
        {entity.createdBy && (
          <span className="text-muted-foreground">
            {' · '}
            {entity.createdByName ?? entity.createdBy}
          </span>
        )}
      </Fact>

      <Fact label={t('objects.fields.updated')}>{at(entity.updatedAt)}</Fact>

      {entity.deleted && (
        <Fact label={t('common.deleted')}>
          <span className="flex flex-wrap items-center gap-1.5 text-destructive">
            <Badge
              variant="outline"
              className="border-destructive text-[10px] text-destructive"
            >
              {t('common.deleted')}
            </Badge>
            {entity.deletedAt && at(entity.deletedAt)}
            {entity.deletedBy &&
              `· ${entity.deletedByName ?? entity.deletedBy}`}
          </span>
        </Fact>
      )}
    </dl>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
