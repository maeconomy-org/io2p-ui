/**
 * Pure formatters used by the Product Passport renderer. Kept side-effect-free
 * and string-in/string-out so they can be unit-tested without React.
 */

/** Tailwind class set per energy-label grade (EU label palette, A+++ → G). */
export const ENERGY_LABEL_PALETTE: Record<string, string> = {
  'A+++': 'bg-emerald-600 text-white border-emerald-700',
  'A++': 'bg-emerald-500 text-white border-emerald-600',
  'A+': 'bg-emerald-500 text-white border-emerald-600',
  A: 'bg-green-500 text-white border-green-600',
  B: 'bg-lime-400 text-lime-950 border-lime-500',
  C: 'bg-yellow-300 text-yellow-950 border-yellow-400',
  D: 'bg-amber-400 text-amber-950 border-amber-500',
  E: 'bg-orange-400 text-orange-950 border-orange-500',
  F: 'bg-red-500 text-white border-red-600',
  G: 'bg-red-700 text-white border-red-800',
}

export function getEnergyLabelClasses(value: string): string | null {
  return ENERGY_LABEL_PALETTE[value.trim().toUpperCase()] ?? null
}

/**
 * Map a free-text status value to a Tailwind badge class set. The matcher
 * is intentionally loose because operators write status in many shapes
 * ("Active", "In Use", "Decommissioned").
 */
export function getStatusBadgeClasses(value: string): string {
  const v = value.toLowerCase()
  if (/(active|operational|in.?use|live|running)/.test(v))
    return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (/(maintenance|scheduled|planned|pending)/.test(v))
    return 'bg-amber-100 text-amber-800 border-amber-200'
  if (/(decommissioned|inactive|retired|archived|disposed)/.test(v))
    return 'bg-zinc-200 text-zinc-700 border-zinc-300'
  if (/(error|critical|fault|broken|fail)/.test(v))
    return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-blue-100 text-blue-800 border-blue-200'
}

const NAMED_COLOR_HINTS: Record<string, string> = {
  white: '#ffffff',
  black: '#111827',
  silver: '#c0c0c0',
  gray: '#9ca3af',
  grey: '#9ca3af',
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  brown: '#92400e',
  beige: '#e5d4b1',
  cream: '#f5e9c8',
  bronze: '#a97142',
  gold: '#d4af37',
  anthracite: '#383e42',
  ral9016: '#f1f0ea',
}

/** Returns a CSS color string for a named/hex color value, or null if unknown. */
export function resolveColorSwatch(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  for (const key of Object.keys(NAMED_COLOR_HINTS)) {
    if (trimmed.includes(key)) return NAMED_COLOR_HINTS[key]
  }
  return null
}

/**
 * Treat a value as a URL when the dictionary key implies it (e.g.
 * `epd-url`, `website`) or when the value itself starts with http(s).
 */
export function isUrlValue(
  propertyKey: string | undefined,
  value: string
): boolean {
  if (propertyKey?.endsWith('-url') || propertyKey === 'website') return true
  return /^https?:\/\//i.test(value.trim())
}

/**
 * Strip protocol/`www`/trailing slash so an inline link reads as a bare host
 * (the `<dt>` already names the field, e.g. "DATASHEET URL").
 */
export function urlLinkLabel(displayValue: string): string {
  const cleaned = displayValue
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
  return cleaned || displayValue
}
