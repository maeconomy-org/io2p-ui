/**
 * Unit registry + canonicalization.
 *
 * Processes (and later, objects) let users type quantities as free text — "100 kg",
 * "0.1 t", "1 pcs". To compare/sum/visualize them we convert each to ONE canonical unit
 * per dimension (mass -> kg, length -> mm, ...). This module owns that conversion.
 *
 * Nothing here is contractual: add or edit dimensions/units/aliases freely. A "dimension"
 * is a kind of measurement (mass, length, ...); conversion only works WITHIN a dimension
 * (kg <-> t, but never kg <-> pcs).
 */

/** factorToCanonical: multiply a value in `symbol` by this to get the canonical unit. */
export interface Dimension {
  canonical: string
  units: Record<string, number>
}

/**
 * Seed set. The canonical unit for each dimension is whatever maps to factor 1.
 * Edit this object to tune units — it's the single source of truth.
 */
export const DIMENSIONS = {
  mass: {
    canonical: 'kg',
    units: {
      kg: 1,
      g: 0.001,
      mg: 0.000001,
      t: 1000,
      lb: 0.45359237,
      oz: 0.0283495231,
    },
  },
  length: {
    canonical: 'mm',
    units: {
      mm: 1,
      cm: 10,
      dm: 100,
      m: 1000,
      km: 1000000,
      in: 25.4,
      ft: 304.8,
    },
  },
  area: {
    canonical: 'm2',
    units: { m2: 1, mm2: 0.000001, cm2: 0.0001, ha: 10000, km2: 1000000 },
  },
  volume: {
    canonical: 'l',
    units: { l: 1, ml: 0.001, cl: 0.01, dl: 0.1, m3: 1000 },
  },
  count: {
    canonical: 'pcs',
    units: { pcs: 1 },
  },
  energy: {
    canonical: 'kWh',
    units: {
      kWh: 1,
      Wh: 0.001,
      MWh: 1000,
      MJ: 0.2777777778,
      J: 0.0000002777777778,
    },
  },
} as const satisfies Record<string, Dimension>

export type DimensionName = keyof typeof DIMENSIONS

/**
 * Aliases map user-typed unit spellings to a canonical symbol used in DIMENSIONS.
 * Keys are matched case-insensitively after de-pluralizing (see normalizeUnit).
 * Keep symbols here identical to the keys in DIMENSIONS.
 */
export const UNIT_ALIASES: Record<string, string> = {
  // mass
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  t: 't',
  ton: 't',
  tons: 't',
  tonne: 't',
  tonnes: 't',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  // length
  mm: 'mm',
  millimeter: 'mm',
  millimeters: 'mm',
  millimetre: 'mm',
  millimetres: 'mm',
  cm: 'cm',
  centimeter: 'cm',
  centimeters: 'cm',
  centimetre: 'cm',
  centimetres: 'cm',
  dm: 'dm',
  decimeter: 'dm',
  decimeters: 'dm',
  m: 'm',
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  km: 'km',
  kilometer: 'km',
  kilometers: 'km',
  kilometre: 'km',
  kilometres: 'km',
  in: 'in',
  inch: 'in',
  inches: 'in',
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  // area
  m2: 'm2',
  sqm: 'm2',
  mm2: 'mm2',
  cm2: 'cm2',
  ha: 'ha',
  hectare: 'ha',
  hectares: 'ha',
  km2: 'km2',
  // volume
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  cl: 'cl',
  dl: 'dl',
  m3: 'm3',
  cbm: 'm3',
  // count
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  ea: 'pcs',
  each: 'pcs',
  unit: 'pcs',
  units: 'pcs',
  x: 'pcs',
  // energy
  kwh: 'kWh',
  wh: 'Wh',
  mwh: 'MWh',
  mj: 'MJ',
  j: 'J',
}

// symbol -> { dimension, factor } index, built once from DIMENSIONS.
const SYMBOL_INDEX: Record<
  string,
  { dimension: DimensionName; factor: number }
> = (() => {
  const index: Record<string, { dimension: DimensionName; factor: number }> = {}
  for (const name of Object.keys(DIMENSIONS) as DimensionName[]) {
    const dim = DIMENSIONS[name]
    for (const [symbol, factor] of Object.entries(dim.units)) {
      index[symbol] = { dimension: name, factor }
    }
  }
  return index
})()

/**
 * Resolve a raw unit string ("Tonnes", "kgs", "m³") to a known canonical symbol,
 * or null if unrecognized. Case-insensitive; tolerates a trailing plural "s".
 */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase().replace(/³/g, '3').replace(/²/g, '2')
  if (!cleaned) return null
  if (UNIT_ALIASES[cleaned]) return UNIT_ALIASES[cleaned]
  // tolerate an unknown trailing plural (e.g. "widgets" is still unknown, but "boxs" -> "box")
  if (cleaned.endsWith('s') && UNIT_ALIASES[cleaned.slice(0, -1)]) {
    return UNIT_ALIASES[cleaned.slice(0, -1)]
  }
  return null
}

/** The dimension a (raw or canonical) unit belongs to, or null if unknown. */
export function dimensionOf(
  unit: string | null | undefined
): DimensionName | null {
  const symbol = normalizeUnit(unit)
  return symbol ? (SYMBOL_INDEX[symbol]?.dimension ?? null) : null
}

export interface CanonicalQuantity {
  /** value converted into the dimension's canonical unit */
  value: number
  /** the canonical unit symbol (e.g. "kg") */
  unit: string
}

/**
 * Convert a numeric value in some unit to its dimension's canonical unit.
 * Returns null when the unit is unrecognized (caller decides the fallback).
 */
export function toCanonical(
  value: number,
  unit: string | null | undefined
): CanonicalQuantity | null {
  const symbol = normalizeUnit(unit)
  if (!symbol) return null
  const entry = SYMBOL_INDEX[symbol]
  if (!entry) return null
  return {
    value: value * entry.factor,
    unit: DIMENSIONS[entry.dimension].canonical,
  }
}
