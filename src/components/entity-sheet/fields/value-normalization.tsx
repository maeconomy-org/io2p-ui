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
import type { DerivedValues } from './value-provenance'

/**
 * A quiet marker at the end of a value row, explaining on hover what the node made of the value.
 *
 * It renders at most an icon, and usually nothing, because the two facts worth surfacing are both
 * rare:
 *
 * - a unit CONVERSION ("2 t" -> 2000 kg). Hidden whenever the canonical form is just the raw text
 *   again, which covers nearly every value.
 * - a value a formula DEPENDS ON that the normalizer could not read. The node drops such a value
 *   from the calculation, so the result is quietly wrong with nothing on screen to say so.
 *
 * The second condition is deliberately about being USED, not about failing to parse. A barcode or a
 * serial number never parses as a quantity, and that is not a mistake — flagging it would put a
 * warning on half the properties in the system. It only becomes an error when something is trying
 * to compute with it.
 */
export function ValueNormalization({
  value,
  usedInFormula = false,
  className,
}: {
  value: Pick<DraftValue, 'data' | 'num' | 'unit' | 'parse'>
  /** True when some derived value binds this one — see `formulaBoundValueIds`. */
  usedInFormula?: boolean
  className?: string
}) {
  const t = useTranslations()
  const format = useFormatter()

  if (value.parse?.ok === false) {
    if (!usedInFormula) return null
    const detail = t(parseFailureKey(value.parse))
    return (
      <Marker
        state="excluded"
        className={cn('text-destructive', className)}
        label={detail}
        tooltip={`${detail} — ${t('objects.properties.excludedFromFormulas')}`}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
    )
  }

  if (value.num === undefined || !differsFromRaw(value)) return null

  const canonical = `${format.number(value.num)}${value.unit ? ` ${value.unit}` : ''}`
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
            data-state={state}
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
