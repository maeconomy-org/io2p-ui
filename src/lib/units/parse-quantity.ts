/**
 * Parse a free-text quantity value ("100 kg", "0.1 t", "100", "1 pcs") into a number and
 * an optional unit. The value field stays free text (like object properties); this is the
 * single place that extracts a usable number from it.
 *
 * Used at save time (to derive the stored #unit / #canon) and in the formula layer (so a
 * formula referencing a quantity gets a clean number, never "100 tons"). It never restricts
 * what the user can type — unparseable input simply yields value: null.
 */
import { normalizeUnit, toCanonical } from './unit-registry'

export interface ParsedQuantity {
  /** the raw string as typed, untouched */
  raw: string
  /** leading numeric part, or null if none was found */
  value: number | null
  /** the unit text as typed (trimmed), or null if absent */
  unit: string | null
  /** canonical unit symbol if the unit is recognized, else null */
  canonicalUnit: string | null
  /** value in the canonical unit; falls back to `value` when the unit is unknown/absent */
  canonicalValue: number | null
}

// leading optional sign, digits with optional decimal (1, 1.5, .5, -2), then the rest.
// Accepts a comma decimal separator ("0,5") but NOT thousands separators (ambiguous).
const NUMBER_RE = /^\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(.*)$/

/**
 * Best-effort parse. Examples:
 *   "100 kg"  -> { value: 100, unit: "kg", canonicalUnit: "kg", canonicalValue: 100 }
 *   "0.1 t"   -> { value: 0.1, unit: "t",  canonicalUnit: "kg", canonicalValue: 100 }
 *   "100"     -> { value: 100, unit: null, canonicalUnit: null, canonicalValue: 100 }
 *   "5 widgets" -> { value: 5, unit: "widgets", canonicalUnit: null, canonicalValue: 5 }
 *   "n/a"     -> { value: null, unit: null, canonicalUnit: null, canonicalValue: null }
 */
export function parseQuantity(raw: string | null | undefined): ParsedQuantity {
  const text = (raw ?? '').toString()
  const empty: ParsedQuantity = {
    raw: text,
    value: null,
    unit: null,
    canonicalUnit: null,
    canonicalValue: null,
  }

  const match = text.match(NUMBER_RE)
  if (!match) return empty

  const value = parseFloat(match[1].replace(',', '.'))
  if (Number.isNaN(value)) return empty

  const unitText = match[2].trim()
  const unit = unitText.length > 0 ? unitText : null

  const canonical = unit ? toCanonical(value, unit) : null
  return {
    raw: text,
    value,
    unit,
    canonicalUnit: canonical?.unit ?? null,
    // unknown/absent unit: the number itself is the best canonical we have
    canonicalValue: canonical ? canonical.value : value,
  }
}

/** Convenience: true when the value has a parseable leading number. */
export function hasNumericValue(raw: string | null | undefined): boolean {
  return parseQuantity(raw).value !== null
}

/** Convenience: true when the unit (if any) maps to a known dimension. */
export function hasKnownUnit(raw: string | null | undefined): boolean {
  const { unit } = parseQuantity(raw)
  return unit !== null && normalizeUnit(unit) !== null
}
