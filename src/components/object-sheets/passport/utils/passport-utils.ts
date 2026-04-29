import {
  PROPERTY_DICTIONARY,
  getDictionaryEntry,
  type PropertyDictionaryEntry,
} from '@/constants/property-dictionary'

/**
 * The "passport" view organizes a flat property list into semantic cards.
 * These categories drive both the bucketing in `groupPropertiesByCategory`
 * and the order in which cards appear in the UI.
 */
export const PASSPORT_CATEGORY_ORDER = [
  'product',
  'classification',
  'dimensions',
  'composition',
  'appearance',
  'sustainability',
  'commerce',
  'ownership',
  'state',
  'contact',
  'location',
  'meta',
] as const

export type PassportCategory = (typeof PASSPORT_CATEGORY_ORDER)[number]

/**
 * Lifecycle keys are surfaced separately as a hero "ribbon" of progress
 * indicators rather than as a generic card — they need date math and
 * visual treatment that a key/value list can't express.
 */
const LIFECYCLE_KEYS = new Set([
  'production-date',
  'installation-date',
  'warranty-end',
  'last-inspection',
  'next-maintenance',
  'lifespan-years',
])

/**
 * Keys whose values are surfaced prominently elsewhere in the passport
 * (e.g. status as a hero badge). Excluded from category cards to avoid
 * showing the same datum twice.
 */
const HERO_SURFACED_KEYS = new Set(['status'])

export interface NormalizedProperty {
  uuid?: string
  key?: string
  label?: string
  values?: Array<{
    uuid?: string
    value?: unknown
    valueTypeCast?: string
    formulaData?: unknown
  }>
}

/**
 * Concatenate a property's non-empty values into a single human-readable
 * string. Multi-value properties become "v1, v2" — good enough for the
 * passport's read-only display; the Properties tab still owns full editing.
 */
export function flattenValues(property: NormalizedProperty): string {
  const parts = (property.values ?? [])
    .map((v) =>
      v?.value === undefined || v?.value === null ? '' : String(v.value)
    )
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.join(', ')
}

export function findPropertyByKey(
  properties: NormalizedProperty[],
  key: string
): NormalizedProperty | undefined {
  return properties.find((p) => p.key === key)
}

export function findValueByKey(
  properties: NormalizedProperty[],
  key: string
): string {
  const match = findPropertyByKey(properties, key)
  return match ? flattenValues(match) : ''
}

export interface CategoryGroup {
  category: PassportCategory | 'other'
  entries: Array<{
    property: NormalizedProperty
    dictEntry?: PropertyDictionaryEntry
    displayLabel: string
    displayValue: string
  }>
}

/**
 * Bucket properties into passport categories. Lifecycle keys are excluded
 * because they're rendered by the lifecycle ribbon, not as cards. Properties
 * without a dictionary match (or with an unknown category) land in "other"
 * so we never silently drop user data.
 */
export function groupPropertiesByCategory(
  properties: NormalizedProperty[],
  locale: 'en' | 'nl' = 'en'
): CategoryGroup[] {
  const buckets = new Map<
    PassportCategory | 'other',
    CategoryGroup['entries']
  >()

  for (const property of properties) {
    if (!property?.key) continue
    if (LIFECYCLE_KEYS.has(property.key)) continue
    if (HERO_SURFACED_KEYS.has(property.key)) continue

    const value = flattenValues(property)
    if (!value) continue

    const dictEntry = getDictionaryEntry(property.key)
    const rawCategory = dictEntry?.category as PassportCategory | undefined
    const category: PassportCategory | 'other' =
      rawCategory && PASSPORT_CATEGORY_ORDER.includes(rawCategory)
        ? rawCategory
        : 'other'

    const displayLabel =
      dictEntry?.labels[locale] ?? property.label ?? property.key

    const list = buckets.get(category) ?? []
    list.push({ property, dictEntry, displayLabel, displayValue: value })
    buckets.set(category, list)
  }

  const ordered: CategoryGroup[] = []
  for (const cat of PASSPORT_CATEGORY_ORDER) {
    const entries = buckets.get(cat)
    if (entries && entries.length > 0) ordered.push({ category: cat, entries })
  }
  const other = buckets.get('other')
  if (other && other.length > 0)
    ordered.push({ category: 'other', entries: other })

  return ordered
}

/** Try to parse an ISO-ish date string. Returns null if unparseable. */
export function parseDateValue(value: string | undefined | null): Date | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const ts = Date.parse(trimmed)
  if (Number.isNaN(ts)) return null
  return new Date(ts)
}

export interface DateRangeProgress {
  /** Percentage of elapsed time between `from` and `to` (0–100, clamped). */
  percent: number
  /** True when `to` is in the past. */
  isOverdue: boolean
  /** Absolute days from today to `to`. Negative if past, positive if future. */
  daysRemaining: number
  from: Date
  to: Date
}

/**
 * Compute a 0–100 progress percentage between two dates, anchored to today.
 * Used for warranty (`production-date` → `warranty-end`) and any other
 * countdown-style indicator the passport needs to draw.
 */
export function computeDateProgress(
  from: Date | null,
  to: Date | null,
  now: Date = new Date()
): DateRangeProgress | null {
  if (!from || !to) return null
  const fromMs = from.getTime()
  const toMs = to.getTime()
  if (toMs <= fromMs) return null

  const span = toMs - fromMs
  const elapsed = Math.max(0, Math.min(span, now.getTime() - fromMs))
  const percent = Math.round((elapsed / span) * 100)
  const daysRemaining = Math.round(
    (toMs - now.getTime()) / (1000 * 60 * 60 * 24)
  )
  return {
    percent,
    isOverdue: now.getTime() > toMs,
    daysRemaining,
    from,
    to,
  }
}

/** True when the property dictionary defines this key. */
export function isKnownPassportKey(key: string | undefined): boolean {
  if (!key) return false
  return PROPERTY_DICTIONARY.some((entry) => entry.key === key)
}

/** Flatten a property file list — used for the documents strip. */
export interface PassportFile {
  uuid?: string
  fileName?: string
  contentType?: string
  size?: number
  softDeleted?: boolean
}

export function isImageFile(file: PassportFile | undefined): boolean {
  const ct = file?.contentType ?? ''
  return ct.startsWith('image/')
}
