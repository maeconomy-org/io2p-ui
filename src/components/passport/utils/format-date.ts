/**
 * Locale-aware short date formatter (e.g. "Apr 12, 2024" / "12 apr. 2024").
 * Returns an empty string for null inputs so callers can pipe directly into
 * JSX without null-guards.
 */
export function formatDate(d: Date | null, locale: string): string {
  if (!d) return ''
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
