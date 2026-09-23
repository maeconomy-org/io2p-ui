'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { AlertTriangle, Scale } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DraftValue, ValueParse } from '@/lib/entity'
import { resolveKey } from '@/constants/property-dictionary'
import type { DerivedValues } from './value-provenance'

/**
 * A quiet marker at the end of a value row, explaining on hover what the node made of the value.
 *
 * It renders at most an icon, and usually nothing, because the two facts worth surfacing are both
 * rare:
 *
 * - a unit CONVERSION ("2 t" -> 2000 kg). Hidden whenever the canonical form is just the raw text
 *   again, which covers nearly every value.
 * - a value some CALCULATION depends on that the normalizer could not read. The node drops such a
 *   value, so the result is quietly wrong with nothing on screen to say so. Two things calculate
 *   with a value: a formula that binds it, and a rollup rule that scales its totals by it.
 *
 * The second condition is deliberately about being USED, not about failing to parse. A barcode or a
 * serial number never parses as a quantity, and that is not a mistake — flagging it would put a
 * warning on half the properties in the system. It only becomes an error when something is trying
 * to compute with it.
 */
export function ValueNormalization({
  value,
  unitVerified,
  usedInFormula = false,
  usedAsMultiplier = false,
  className,
}: {
  value: Pick<DraftValue, 'data' | 'num' | 'unit' | 'parse'>
  /** A derived value's `provenance.unitVerified`. */
  unitVerified?: boolean
  /** True when some derived value binds this one — see `formulaBoundValueIds`. */
  usedInFormula?: boolean
  /** True when a rollup rule scales its totals by this value's key — see `multiplierKeysOf`. */
  usedAsMultiplier?: boolean
  className?: string
}) {
  const t = useTranslations()
  const format = useFormatter()

  if (value.parse?.ok === false) {
    if (!usedInFormula && !usedAsMultiplier) return null
    const detail = t(parseFailureKey(value.parse))
    return (
      <Marker
        state="excluded"
        className={cn('text-destructive', className)}
        label={detail}
        tooltip={`${detail} — ${t(excludedFromKey(usedInFormula, usedAsMultiplier))}`}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
    )
  }

  // The node will not scale a total by a quantity it could not check, with or without a unit, so
  // the object is dropped from that rule's total.
  if (usedAsMultiplier && unitVerified === false) {
    const detail = t('objects.properties.unitNotChecked')
    return (
      <Marker
        state="excluded"
        className={cn('text-destructive', className)}
        label={detail}
        tooltip={`${detail} — ${t(excludedFromKey(false, true))}`}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
    )
  }

  if (value.num === undefined || !differsFromRaw(value)) return null

  const canonical = canonicalText(value, (n) => format.number(n))
  return (
    <Marker
      state="canonical"
      className={cn('text-muted-foreground', className)}
      label={canonical}
      tooltip={`${t('objects.properties.canonicalValue')}: ${canonical}`}
      icon={<Scale className="h-3.5 w-3.5" />}
    />
  )
}

/**
 * Every value id bound by some derived value's recipe. Computed from the traces the sheet already
 * holds, so no extra prop has to be threaded down to the rows.
 */
export function formulaBoundValueIds(
  derivedValues: DerivedValues
): Set<string> {
  const bound = new Set<string>()
  for (const provenance of derivedValues.values()) {
    for (const arg of provenance?.args ?? []) {
      if (arg.source.kind === 'property') bound.add(arg.source.valueId)
    }
  }
  return bound
}

/**
 * The key a rollup rule matches a property by. A saved key is compared as core compares it, lower
 * case and otherwise untouched (`items_per_box` stays). A property with no key yet has only its
 * label, which the rule form resolves through the dictionary ("Aantal" is `quantity`).
 */
export const ruleKey = (key: string | undefined, label?: string) =>
  key ? key.toLowerCase() : resolveKey(label ?? '').key.toLowerCase()

/** Property key → the key its rule multiplies by, as the node applied it (both lower case). */
export function rollupMultipliers(
  rollups:
    | ReadonlyMap<
        string,
        { propertyKey: string; multiplyBy?: { propertyKey: string } }
      >
    | undefined
): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of rollups?.values() ?? []) {
    const by = entry.multiplyBy?.propertyKey
    if (by) out.set(entry.propertyKey.toLowerCase(), by.toLowerCase())
  }
  return out
}

/**
 * Every property key some rollup rule multiplies by. A value under one of these keys is an input to
 * a total even though nothing on the row says so — an unreadable one does not make the total empty,
 * it drops that object's whole contribution.
 */
export function multiplierKeysOf(
  rollups:
    | ReadonlyMap<string, { multiplyBy?: { propertyKey: string } }>
    | undefined
): Set<string> {
  const keys = new Set<string>()
  for (const entry of rollups?.values() ?? []) {
    const key = entry.multiplyBy?.propertyKey
    if (key) keys.add(key.toLowerCase())
  }
  return keys
}

/**
 * The icon carries its meaning in `aria-label`, not only in the tooltip — a hover-only affordance is
 * invisible to a keyboard or a screen reader. It's a real button so it can take focus.
 */
function Marker({
  icon,
  label,
  tooltip,
  state,
  className,
}: {
  icon: React.ReactNode
  label: string
  tooltip: string
  /** Which of the two markers this is — the state carries it, not the colour or the prose. */
  state: 'canonical' | 'excluded'
  className?: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="value-normalization"
            // `data-marker`, NOT `data-state`: this button is a Radix `TooltipTrigger asChild`, and
            // Radix writes its own `data-state` there for open/close styling. Slot merge order
            // happens to let a child prop win today, so ours survived and clobbered theirs — a
            // product bug on its own, and one a version bump silently flips. The `value-mode` /
            // `data-mode` precedent this followed chose `data-mode` for exactly this reason.
            data-marker={state}
            aria-label={label}
            className={cn('shrink-0 cursor-default', className)}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Naming the consumer is the whole point of the warning: "not a number" is obvious from the text,
// "and therefore your building's weight is short by one pump" is not. Exported because the message
// it picks lives in a tooltip, which Radix renders in a portal only once opened — the choice is
// worth asserting directly rather than through a hover.
export function excludedFromKey(
  inFormula: boolean,
  asMultiplier: boolean
): string {
  if (inFormula && asMultiplier) return 'objects.properties.excludedFromBoth'
  return asMultiplier
    ? 'objects.properties.excludedFromRollups'
    : 'objects.properties.excludedFromFormulas'
}

function parseFailureKey(parse: ValueParse): string {
  return parse.reason === 'unknown-unit'
    ? 'objects.properties.unknownUnit'
    : 'objects.properties.noNumber'
}

/**
 * Whether the canonical form says anything the raw text doesn't. Whitespace is REMOVED rather than
 * collapsed, so "10m" and "10 m" compare equal — the node always renders a space before the unit,
 * and a spacing difference is not a conversion worth reporting.
 */
function differsFromRaw(
  value: Pick<DraftValue, 'data' | 'num' | 'unit'>
): boolean {
  const canonical = value.unit ? `${value.num} ${value.unit}` : `${value.num}`
  return bare(canonical) !== bare(value.data ?? '')
}

const bare = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/**
 * The canonical form as a reader should see it: grouped digits and the unit, `20,000 kg`.
 *
 * Shared with the value row, so the ⚖ tooltip and the row it sits on cannot describe the same
 * number two ways.
 */
export function canonicalText(
  value: Pick<DraftValue, 'num' | 'unit'>,
  formatNumber: (n: number) => string
): string {
  if (value.num === undefined) return ''
  return `${formatNumber(value.num)}${value.unit ? ` ${value.unit}` : ''}`
}

/**
 * What a DERIVED value should read as.
 *
 * A recipe that DECLARES a unit gets its display text from the node — `data` is already
 * "20 t" — so it is left alone. One that declares nothing gets `data` as a bare number, which
 * is how a derived row came to show `20000` beside two authored `10 t` values. That case is
 * rebuilt from the canonical fields, which is the same figure the ⚖ marker was already
 * carrying in its tooltip and nowhere else.
 */
export function derivedText(
  value: Pick<DraftValue, 'data' | 'num' | 'unit'>,
  provenance: { unitSource?: string } | undefined,
  formatNumber: (n: number) => string
): string | undefined {
  if (provenance?.unitSource === 'declared') return undefined
  const text = canonicalText(value, formatNumber)
  return text === '' ? undefined : text
}
