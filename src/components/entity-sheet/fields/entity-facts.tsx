'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Check, Copy } from 'lucide-react'
import type { ObjectDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import { logger } from '@/lib'

/**
 * Server-owned facts about a saved entity: its id and timestamps. Read-only by definition — nothing
 * here is authored, so it sits apart from the editable fields rather than among them.
 */
export function EntityFacts({ entity }: { entity: ObjectDTO }) {
  const t = useTranslations()
  const format = useFormatter()

  const stamps: [string, number | undefined][] = [
    [t('objects.fields.created'), entity.createdAt],
    [t('objects.fields.updated'), entity.updatedAt],
  ]

  return (
    <dl className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('objects.fields.uuid')}
        </dt>
        <dd className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {entity.id}
          </code>
          <CopyButton value={entity.id} />
        </dd>
      </div>

      {stamps.map(([label, at]) =>
        at ? (
          <div key={label} className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm">
              {format.dateTime(new Date(at), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </dd>
          </div>
        ) : null
      )}
    </dl>
  )
}

function CopyButton({ value }: { value: string }) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      // Clipboard access can be denied (insecure context, permissions) — the id is still selectable.
      logger.error('Copy to clipboard failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      aria-label={t('common.copy')}
      title={t('common.copy')}
      onClick={copy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
