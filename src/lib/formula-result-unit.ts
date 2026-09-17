// The unit half of `io2p-core/src/shared/calc.derive.fold.ts` at commit c721daa, mirrored the way
// `formula-expression.ts` mirrors `calc.eval.ts`.
//
// It exists for ONE caller: the bind preview, which must print the figure the sheet will print
// once the value is saved. That figure is not the expression result — it depends on four arms, and
// picking the wrong one is off by the declared unit's factor, silently. A shortcut was tried and
// was wrong: `a * n` over 5 kWh and 0.4 declared tCO2e reads "2 tCO2e", not 0.002.
//
// `CANONICAL` and `lookupUnit` come from the served vocabulary rather than a second copy of the
// table — the node serves it for exactly this reason.

import { inheritanceSafe, keepsArgDimension } from './formula-expression'

/** One unit as the node serves it. Structural, so the SDK's `UnitEntry` satisfies it. */
export interface UnitLike {
  symbol: string
  dimension: string
  aliases: string[]
  canonical: boolean
  toCanonical: number
}

/** A property-bound argument with the canonical unit of the value it reads, when it has one. */
export interface UnitArg {
  var: string
  unit?: string
}

export type UnitResolution =
  | {
      kind: 'error'
      code: 'dimension-mismatch' | 'unknown-unit'
      detail: string
    }
  | {
      kind: 'declared'
      unit: string
      factor: number
      symbol: string
      symbolFactor: number
      verified: boolean
    }
  | { kind: 'inherited'; unit: string }
  | { kind: 'none' }

/** The node's own rounding policy, 12 significant digits. */
const round = (n: number) => Number(n.toPrecision(12))

const lookup = (units: UnitLike[], symbol: string): UnitLike | undefined =>
  units.find(
    (u) =>
      u.symbol === symbol ||
      u.aliases.some((alias) => alias.toLowerCase() === symbol.toLowerCase())
  )

const canonicalOf = (units: UnitLike[], dimension: string): string =>
  units.find((u) => u.dimension === dimension && u.canonical)?.symbol ?? ''

/**
 * Mirrors `resolveResultUnit`. See that function for the policy; the shape here is deliberately
 * the same so the two can be read side by side.
 */
export function resolveResultUnit(
  expression: string,
  declared: string | undefined,
  propertyArgs: readonly UnitArg[],
  constantVars: ReadonlySet<string>,
  units: UnitLike[]
): UnitResolution {
  const propertyVars = new Set(propertyArgs.map((arg) => arg.var))
  const safe = inheritanceSafe(expression, propertyVars)
  const unitBearing = propertyArgs.filter(
    (arg): arg is { var: string; unit: string } => arg.unit !== undefined
  )

  if (safe) {
    const distinct = [...new Set(unitBearing.map((arg) => arg.unit))]
    if (distinct.length > 1) {
      return {
        kind: 'error',
        code: 'dimension-mismatch',
        detail: distinct.join(' vs '),
      }
    }
  }

  if (declared !== undefined) {
    return resolveDeclaredUnit(
      expression,
      declared,
      propertyVars,
      unitBearing,
      constantVars,
      units
    )
  }

  if (
    safe &&
    propertyArgs.length > 0 &&
    unitBearing.length === propertyArgs.length
  ) {
    return { kind: 'inherited', unit: unitBearing[0]!.unit }
  }
  return { kind: 'none' }
}

/** Mirrors `resolveDeclaredUnit` — policy step 2. */
function resolveDeclaredUnit(
  expression: string,
  declared: string,
  propertyVars: ReadonlySet<string>,
  unitBearing: { var: string; unit: string }[],
  constantVars: ReadonlySet<string>,
  units: UnitLike[]
): UnitResolution {
  const spec = lookup(units, declared)
  if (spec === undefined) {
    return { kind: 'error', code: 'unknown-unit', detail: declared }
  }
  const unitVars = new Set(unitBearing.map((arg) => arg.var))
  if (unitBearing.length > 0 && keepsArgDimension(expression, unitVars)) {
    const distinct = [...new Set(unitBearing.map((arg) => arg.unit))]
    const argSpec =
      distinct.length === 1 ? lookup(units, distinct[0]!) : undefined
    if (argSpec?.dimension === spec.dimension) {
      return {
        kind: 'declared',
        unit: canonicalOf(units, spec.dimension),
        factor: 1,
        symbol: spec.symbol,
        symbolFactor: spec.toCanonical,
        verified: true,
      }
    }
    const variables = new Set([...propertyVars, ...constantVars])
    if (distinct.length > 1 || keepsArgDimension(expression, variables)) {
      return {
        kind: 'error',
        code: 'dimension-mismatch',
        detail: `${spec.symbol} (${spec.dimension}) vs ${distinct.join(' vs ')}`,
      }
    }
  } else if (unitBearing.length > 0) {
    return {
      kind: 'declared',
      unit: canonicalOf(units, spec.dimension),
      factor: 1,
      symbol: spec.symbol,
      symbolFactor: spec.toCanonical,
      verified: false,
    }
  }
  return {
    kind: 'declared',
    unit: canonicalOf(units, spec.dimension),
    factor: spec.toCanonical,
    symbol: spec.symbol,
    symbolFactor: spec.toCanonical,
    verified: true,
  }
}

/**
 * What the sheet will print for this result — `data` as the fold writes it.
 *
 * `undefined` when the node would refuse the value: there is no number to preview, and the caller
 * shows the refusal instead.
 */
export function resultDisplay(
  result: number,
  resolution: UnitResolution
): string | undefined {
  if (resolution.kind === 'error') return undefined
  if (resolution.kind !== 'declared') return String(round(result))
  const num = round(result * resolution.factor)
  return `${round(num / resolution.symbolFactor)} ${resolution.symbol}`
}
