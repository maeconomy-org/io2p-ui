/**
 * Import display formatters. No React, no `'use client'` — they were trapped behind a client
 * boundary by sharing a file with two components, which put them out of reach of a server
 * component and dragged React into a test that only checks a string.
 *
 * All three follow the BROWSER locale, not the app's language: these are instants and counts, the
 * same whichever language the UI is in. That also means their output must go into plain `{count}`
 * placeholders, never ICU `{count, number}` — next-intl would format with the APP locale and print
 * "1,847 created" beside "of 1.847" on one line.
 */

export function formatDuration(
  from?: number | null,
  to?: number | null
): string {
  if (!from) return '—'
  const end = to ?? Date.now()
  const seconds = Math.max(0, Math.round((end - from) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

export function formatClock(ts?: number | null): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export const n = (value: number) => new Intl.NumberFormat().format(value)
