import { useFormatter } from 'next-intl'

/**
 * Formats a `YYYY-MM-DD` day. A day has no time zone and the app formatter runs in UTC, so the day
 * is read as a UTC date: local midnight formatted in UTC is the day before east of Greenwich.
 */
export function useDayText() {
  const format = useFormatter()
  return (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
}
