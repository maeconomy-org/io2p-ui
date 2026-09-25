'use client'

import { Fragment, useId, useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { AlertTriangle, Check, ChevronDown, Sigma } from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useConstants, useFormulas } from '@/hooks/api/leaves'
import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type {
  DraftProperty,
  ValueProvenance as ValueProvenanceData,
} from '@/lib/entity'

import { useCollapsible } from '../collapse-all'
import { equationText } from './formula-equation'

/**
 * Derived values of the loaded entity, keyed by value id. Presence means the value is derived; the
 * payload is its trace, which is `undefined` for anything the node computed before provenance existed.
 */
export type DerivedValues = ReadonlyMap<string, ValueProvenanceData | undefined>

/**
 * One derived value as its row: the result, the formula with the inputs written in, at most one
 * mark, and a Σ toggle for the details. The equation answers "where did this number come from"
 * without opening anything; the details are for the rest.
 *
 * Pure props on purpose: the caller resolves labels and texts (it already holds the entity), so the
 * row stays renderable from a test with no client, no query and no provider. Only the opened details
 * fetch, for the formula's and the constants' names.
 */
export function ValueProvenanceDisplay({
  provenance,
  unit,
  display,
  exact,
  labelForValue,
  textForValue,
  marker,
  trailing,
  className,
}: {
  provenance: ValueProvenanceData
  /** The value's own canonical unit. Decides what an unchecked result means for totals. */
  unit?: string
  /** The value as the row shows it. Absent renders the equation and marks alone. */
  display?: string
  /** The stored text, on hover, when `display` rounds it. */
  exact?: string
  /** Property label for an arg bound to a sibling value. Falls back to the variable name alone. */
  labelForValue?: (valueId: string) => string | undefined
  /** The bound sibling value as its own row reads it (`2 kW`), for the equation and the inputs. */
  textForValue?: (valueId: string) => string | undefined
  /** A value marker (the multiplier refusal) placed with the marks, before the toggle. */
  marker?: React.ReactNode
  /** Another row toggle (the value's files), after the formula's. */
  trailing?: React.ReactNode
  className?: string
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [open, setOpen] = useCollapsible()
  const detailsId = useId()
  const { error } = provenance
  const unchecked = !error && uncheckedState(provenance, unit)

  const argText = (arg: ValueProvenanceData['args'][number]) =>
    (arg.source.kind === 'property'
      ? textForValue?.(arg.source.valueId)
      : undefined) ??
    (arg.value === undefined ? undefined : format.number(arg.value))
  const equation = equationText(provenance.expression, (name) => {
    const arg = provenance.args.find((a) => a.var === name)
    return arg && argText(arg)
  })
  // A code this app does not know reads as the badge already says; repeating it is noise.
  const errorLine = error && calcErrorText(error.code, t)
  const reason =
    error && errorLine !== t('objects.properties.formulaError')
      ? errorLine
      : unchecked === 'left-out'
        ? t('objects.properties.unitNotCountedShort')
        : undefined

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {display !== undefined && (
          <span className="shrink-0" title={exact || undefined}>
            {display}
          </span>
        )}
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={equation}
          data-testid="provenance-equation"
        >
          = {equation}
        </span>

        {/* An unevaluated formula previously rendered as an ordinary empty value — the failure was
            invisible. Pair the colour with an icon and text so it doesn't rely on red alone. */}
        {error && (
          <Badge
            variant="outline"
            data-testid="provenance-error"
            className="h-5 shrink-0 gap-1 border-destructive/60 bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive"
          >
            <AlertTriangle className="h-3 w-3" />
            {t('objects.properties.formulaError')}
          </Badge>
        )}
        {unchecked === 'left-out' && (
          <Badge
            variant="outline"
            data-testid="provenance-unit-left-out"
            className="h-5 shrink-0 gap-1 border-amber-500/60 bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {t('objects.properties.unitNotCounted')}
          </Badge>
        )}
        {/* Counted, in the total without a unit: information, so grey, not a warning colour. */}
        {unchecked === 'plain' && (
          <Badge
            variant="secondary"
            data-testid="provenance-unit-unchecked"
            className="h-5 shrink-0 px-1.5 text-[11px] font-medium"
          >
            {t('objects.properties.noUnit')}
          </Badge>
        )}
        {marker}

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
          data-testid="provenance-chip"
          className="ml-auto flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Sigma className="h-3.5 w-3.5" />
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </button>
        {trailing}
      </div>

      {reason && (
        <p
          data-testid="provenance-reason"
          className={cn(
            'text-xs',
            error ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
          )}
        >
          {reason}
        </p>
      )}

      {open && (
        <FormulaFacts
          id={detailsId}
          provenance={provenance}
          unit={unit}
          unchecked={unchecked}
          labelForValue={labelForValue}
          argText={argText}
        />
      )}
    </div>
  )
}

/**
 * The opened details, in a fixed order: formula, inputs, result, status. Split out because it is
 * the only part that fetches (the formula's and the constants' names), and only once asked for.
 */
function FormulaFacts({
  id,
  provenance,
  unit,
  unchecked,
  labelForValue,
  argText,
}: {
  id: string
  provenance: ValueProvenanceData
  unit?: string
  unchecked: ReturnType<typeof uncheckedState> | false
  labelForValue?: (valueId: string) => string | undefined
  argText: (arg: ValueProvenanceData['args'][number]) => string | undefined
}) {
  const t = useTranslations()
  const { data: formula } = useFormulas().useGet(provenance.formulaId)
  const constantIds = useMemo(
    () =>
      provenance.args.flatMap((a) =>
        a.source.kind === 'constant' ? [a.source.constantId] : []
      ),
    [provenance.args]
  )
  const constants = useConstants().useByIds(constantIds)
  const { error } = provenance

  const inputLabel = (arg: ValueProvenanceData['args'][number]) =>
    arg.source.kind === 'constant'
      ? (constants.get(arg.source.constantId)?.name ??
        t('objects.properties.constant'))
      : (argSource(arg, labelForValue) ?? arg.var)

  // Where the unit came from; nothing when there is no unit, which the status already says.
  const resultText =
    provenance.unitSource === 'declared'
      ? t('objects.properties.resultDeclared', {
          unit: provenance.declaredUnit ?? '',
        })
      : provenance.unitSource === 'inherited'
        ? unit && t('objects.properties.resultInherited', { unit })
        : // Open set: the node may add a source this build has never heard of, and showing the
          // raw word is better than showing nothing about where the unit came from.
          provenance.unitSource

  const status = error ? (
    // The CODE is translated; `detail` is English diagnostic text by contract, so it rides along
    // as a secondary line rather than being the whole message.
    <div className="space-y-0.5 text-destructive">
      <p>{calcErrorText(error.code, t)}</p>
      {error.detail && <p className="text-[10px] opacity-80">{error.detail}</p>}
    </div>
  ) : unchecked ? (
    <p
      className={cn(
        unchecked === 'left-out' && 'text-amber-700 dark:text-amber-400'
      )}
    >
      {t(
        unchecked === 'left-out'
          ? 'objects.properties.unitNotCountedDetail'
          : 'objects.properties.unitNotCheckedDetail'
      )}
    </p>
  ) : provenance.unitVerified === true ? (
    <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
      <Check className="h-3 w-3" />
      {t('objects.properties.unitChecked')}
    </p>
  ) : unit === undefined ? (
    // Nothing to check: a plain number over plain numbers.
    <p className="text-muted-foreground">
      {t('objects.properties.resultNoUnit')}
    </p>
  ) : null

  // A unit reached through a factor is the author's to check: the node read these unitless inputs
  // per standard unit and cannot know they are given in it. The same sentence the editor shows
  // before saving, with the inputs named as the row names them.
  const factorLine = provenance.unitCheck === 'factor' &&
    (provenance.factorVars?.length ?? 0) > 0 &&
    unit && (
      <p data-testid="provenance-factor" className="text-muted-foreground">
        {t('objects.formulaEditor.warning.factorNoPer', {
          vars: (provenance.factorVars ?? [])
            .map((name) => factorLabel(provenance, name, labelForValue))
            .join(', '),
          count: provenance.factorVars?.length ?? 0,
          unit,
        })}
      </p>
    )

  return (
    <dl
      id={id}
      className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 rounded-md border bg-muted/30 px-2.5 py-2 text-xs"
    >
      <dt className="text-muted-foreground">
        {t('objects.properties.factsFormula')}
      </dt>
      {/* The name only: the row above already shows the formula as its equation. An inline
          formula has no name, so its expression is all there is to show. */}
      <dd className="min-w-0" data-testid="provenance-formula">
        {formula?.name ?? (
          <code className="rounded border bg-background px-1 font-mono">
            {provenance.expression}
          </code>
        )}
      </dd>

      {provenance.args.length > 0 && (
        <>
          <dt className="text-muted-foreground">
            {t('objects.properties.factsInputs')}
          </dt>
          <dd className="grid min-w-0 grid-cols-[auto_1fr_auto] gap-x-2.5 gap-y-0.5">
            {provenance.args.map((arg) => (
              <Fragment key={arg.var}>
                <span className="font-mono text-muted-foreground">
                  {arg.var}
                </span>
                <span className="min-w-0 truncate">
                  {/* A property named like its variable (`v` bound to `v`) would read twice. */}
                  {inputLabel(arg).toLowerCase() === arg.var.toLowerCase()
                    ? ''
                    : inputLabel(arg)}
                </span>
                <span className="text-right tabular-nums">
                  {argText(arg) ?? '—'}
                </span>
              </Fragment>
            ))}
          </dd>
        </>
      )}

      {resultText && (
        <>
          <dt className="text-muted-foreground">
            {t('objects.properties.factsResult')}
          </dt>
          <dd data-testid="provenance-unit">{resultText}</dd>
        </>
      )}

      {(status || factorLine) && (
        <>
          <dt className="text-muted-foreground">
            {t('objects.properties.factsStatus')}
          </dt>
          <dd className="space-y-1">
            {status}
            {factorLine}
          </dd>
        </>
      )}

      {unchecked && (
        <>
          <dt className="text-muted-foreground">
            {t('objects.properties.factsFix')}
          </dt>
          <dd data-testid="provenance-fix">
            {t(
              unchecked === 'left-out'
                ? 'objects.properties.fixNotCounted'
                : 'objects.properties.fixNoUnit'
            )}
          </dd>
        </>
      )}
    </dl>
  )
}

/**
 * What an unchecked result means for totals. Only an explicit `false` is unchecked: an absent
 * `unitVerified` is an ordinary number with nothing to check, the commonest derived value there is.
 * With a unit the node leaves the value out of every total; without one it counts it like any
 * plain number.
 */
export function uncheckedState(
  provenance: Pick<ValueProvenanceData, 'unitVerified'>,
  unit: string | undefined
): 'left-out' | 'plain' | undefined {
  if (provenance.unitVerified !== false) return undefined
  return unit ? 'left-out' : 'plain'
}

// A factor as the row names it: the property it was bound to, else its variable.
function factorLabel(
  provenance: ValueProvenanceData,
  name: string,
  labelForValue?: (valueId: string) => string | undefined
): string {
  const arg = provenance.args.find((a) => a.var === name)
  return (arg && argSource(arg, labelForValue)) ?? name
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
export function calcErrorText(
  code: string,
  t: (key: string) => string
): string {
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
