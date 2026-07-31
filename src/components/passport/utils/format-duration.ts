type TFn = (key: string, values?: Record<string, number | string>) => string

/**
 * Pick the right pluralised "in service for…" unit so we never read
 * "365 days" when "1 year" reads more naturally. Takes the translator
 * function so it can be a pure utility (unlike a hook).
 *
 * Thresholds chosen for human-readable output, not statistical accuracy:
 *  - <60 days  → "12 days"
 *  - <730 days → "5 months"  (~24 months)
 *  - else      → "3 years"
 */
export function formatDurationDays(days: number, t: TFn): string {
  if (days < 60) return t('objects.passport.days', { count: days })
  if (days < 730)
    return t('objects.passport.months', { count: Math.round(days / 30) })
  return t('objects.passport.years', { count: Math.round(days / 365) })
}
