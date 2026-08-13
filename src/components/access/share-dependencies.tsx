'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, Info } from 'lucide-react'
import { Checkbox } from '@/components/ui'
import type { ShareDependency, TemplateShareDependencies } from '@/types'

/**
 * Split the endpoint's answer into the three things a share prompt does with it.
 *
 * A `system` item is dropped entirely — it is visible to everyone, so offering to grant it would
 * describe work that will not happen. The other two piles are the ones the checkbox CANNOT fix, and
 * they are separated because the remedy differs: a deleted binding is broken for the owner too, and
 * an unowned one needs a different person to act.
 */
export function splitDependencies(deps?: TemplateShareDependencies) {
  const all: ShareDependency[] = [
    ...(deps?.formulas ?? []).map((d) => ({ ...d, type: 'formula' as const })),
    ...(deps?.constants ?? []).map((d) => ({
      ...d,
      type: 'constant' as const,
    })),
  ]
  return {
    grantable: all.filter((d) => !d.system && !d.deleted && d.owned),
    // Reported, never omitted: a template that binds a deleted formula resolves for nobody, and
    // silence here would read as "nothing to worry about".
    broken: all.filter((d) => !d.system && d.deleted),
    foreign: all.filter((d) => !d.system && !d.deleted && !d.owned),
  }
}

/**
 * The consent prompt: share the formulas and constants this template binds, or do not.
 *
 * Opt-IN rather than automatic. Sharing a template is one decision and granting read on the library
 * items behind it is another — they are separate resources with their own owners, and a share sheet
 * that quietly widened access to both would be doing something the user never asked for.
 */
export function ShareDependencies({
  deps,
  checked,
  onCheckedChange,
}: {
  deps?: TemplateShareDependencies
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  const t = useTranslations()
  const { grantable, broken, foreign } = splitDependencies(deps)

  if (!grantable.length && !broken.length && !foreign.length) return null

  const names = (items: ShareDependency[]) =>
    items.map((d) => d.name || t('common.unknown')).join(', ')

  return (
    <div className="space-y-2 rounded-md border p-3">
      {grantable.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(next) => onCheckedChange(next === true)}
            data-testid="share-dependencies"
            className="mt-0.5"
          />
          <span>
            {t('access.shareDependencies', {
              count: grantable.length,
              names: names(grantable),
            })}
          </span>
        </label>
      )}

      {broken.length > 0 && (
        <p
          data-testid="share-dependencies-broken"
          className="flex items-start gap-1.5 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t('access.dependenciesDeleted', { names: names(broken) })}
          </span>
        </p>
      )}

      {foreign.length > 0 && (
        <p
          data-testid="share-dependencies-foreign"
          className="flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t('access.dependenciesNotYours', { names: names(foreign) })}
          </span>
        </p>
      )}
    </div>
  )
}
