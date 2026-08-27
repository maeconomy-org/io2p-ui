'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ChevronDown, ChevronUp, Sigma } from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type {
  DraftProperty,
  ValueProvenance as ValueProvenanceData,
} from '@/lib/entity'

/**
 * Derived values of the loaded entity, keyed by value id. Presence means the value is derived; the
 * payload is its trace, which is `undefined` for anything the node computed before provenance existed.
 */
export type DerivedValues = ReadonlyMap<string, ValueProvenanceData | undefined>

/**
 * What a derived value is made of. The node freezes the evaluated expression and every argument it
 * resolved, so a reader can answer "where did this number come from" without opening the editor.
 *
 * Pure props on purpose: the caller resolves arg labels (it already holds the entity), so this stays
 * renderable from a test with no client, no query and no provider.
 */
export function ValueProvenanceDisplay({
  provenance,
  labelForValue,
  className,
}: {
  provenance: ValueProvenanceData
  /** Property label for an arg bound to a sibling value. Falls back to the variable name alone. */
  labelForValue?: (valueId: string) => string | undefined
  className?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const { error } = provenance

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="secondary"
          data-testid="provenance-chip"
          className="h-4 shrink-0 gap-0.5 px-1 text-[10px]"
        >
          <Sigma className="h-2.5 w-2.5" />
          {t('objects.propertyEditor.derived')}
        </Badge>

        {/* An unevaluated formula previously rendered as an ordinary empty value — the failure was
            invisible. Pair the colour with an icon and text so it doesn't rely on red alone. */}
        {error && (
          <Badge
            variant="outline"
            data-testid="provenance-error"
            className="h-4 shrink-0 gap-0.5 border-destructive px-1 text-[10px] text-destructive"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {t('objects.properties.formulaError')}
          </Badge>
        )}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={
            open
              ? t('objects.properties.hideFormula')
              : t('objects.properties.showFormula')
          }
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {open && (
        <div
          id={detailsId}
          className="space-y-1.5 border-l-2 pl-2 text-xs text-muted-foreground"
        >
          <div>
            <span className="font-medium">
              {t('objects.properties.formula')}:
            </span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              {provenance.expression}
            </code>
          </div>

          {provenance.unitSource && (
            <div data-testid="provenance-unit">
              {provenance.unitSource === 'declared' ? (
                <>
                  {t('objects.properties.declaredUnit')}:{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">
                    {provenance.declaredUnit}
                  </code>
                </>
              ) : provenance.unitSource === 'inherited' ? (
                t('objects.properties.unitInherited')
              ) : (
                // Open set: the node may add a source this build has never heard of, and showing
                // the raw word is better than showing nothing about where the unit came from.
                provenance.unitSource
              )}
            </div>
          )}

          {provenance.args.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {provenance.args.map((arg) => (
                <Badge
                  key={arg.var}
                  variant="outline"
                  className="font-mono text-[10px]"
                >
                  {arg.var}
                  {argSource(arg, labelForValue) &&
                    ` = ${argSource(arg, labelForValue)}`}
                  {arg.value !== undefined && ` (${arg.value})`}
                </Badge>
              ))}
            </div>
          )}

          {/* The CODE is translated; `detail` is English diagnostic text by contract, so it rides
              along as a secondary line rather than being the whole message. */}
          {error && (
            <div className="space-y-0.5 text-destructive">
              <p>{calcErrorMessage(error.code, t)}</p>
              {error.detail && (
                <p className="text-[10px] opacity-80">{error.detail}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Which property a bound value belongs to. The trace names sibling values by id, which means nothing
 * to a reader — but the draft already holds the whole tree, so no lookup goes to the network.
 */
export function labelForValueId(
  properties: DraftProperty[],
  valueId: string,
  locale?: PropertyDictionaryLocale
): string | undefined {
  for (const p of properties) {
    // Match `ref` as well as `id`: a not-yet-saved value has only a client ref, and a TEMPLATE value
    // has its ref preserved as the thing sibling calcs bind to. Matching ids alone would leave those
    // bindings labelled as unknown.
    if (p.values.some((v) => v.id === valueId || v.ref === valueId))
      // A formula trace names a sibling PROPERTY, so it reads in the same language as that
      // property's own row — `weight` must not surface here as "Weight" beside a card saying
      // "Gewicht". Locale is optional so a non-rendering caller can still ask for the raw label.
      return locale
        ? resolvePropertyLabel(p.key, p.label, locale)
        : p.label || p.key
  }
  return undefined
}

// What the variable was bound to, in reader terms: a sibling property's label, or the fact that it
// came from a constant. Constant NAMES aren't in the projection — only the id — so we don't guess.
function argSource(
  arg: ValueProvenanceData['args'][number],
  labelForValue?: (valueId: string) => string | undefined
): string | undefined {
  if (arg.source.kind === 'property') {
    return labelForValue?.(arg.source.valueId)
  }
  return undefined
}

/**
 * A calc failure in the reader's language.
 *
 * The node's codes are an OPEN set and `detail` is English by contract, so an unrecognised code
 * falls back to a generic sentence rather than printing an identifier at the user.
 */
function calcErrorMessage(code: string, t: (key: string) => string): string {
  const known = new Set([
    'arg-not-numeric',
    'div-by-zero',
    'domain',
    'non-numeric-result',
    'dimension-mismatch',
    'unknown-unit',
  ])
  return known.has(code)
    ? t(`objects.properties.calcError.${code}`)
    : t('objects.properties.formulaError')
}
