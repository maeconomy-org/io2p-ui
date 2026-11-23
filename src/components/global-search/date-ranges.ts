/** Two `YYYY-MM-DD` days in the browser's time zone; an empty string is an open end. */
export interface DayRange {
  from: string
  to: string
}

export type PresetId =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'

const pad = (n: number) => String(n).padStart(2, '0')

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The local midnight of a `YYYY-MM-DD` day, or null when it is not a real day. */
export function dayOf(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null
}

/** The ranges the date popover offers, counted from `now` in the browser's time zone. */
export function rangePresets(now: Date): (DayRange & { id: PresetId })[] {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const day = (yy: number, mm: number, dd: number) =>
    isoDay(new Date(yy, mm, dd))
  return [
    { id: 'today', from: day(y, m, d), to: day(y, m, d) },
    { id: 'yesterday', from: day(y, m, d - 1), to: day(y, m, d - 1) },
    { id: 'last7', from: day(y, m, d - 6), to: day(y, m, d) },
    { id: 'last30', from: day(y, m, d - 29), to: day(y, m, d) },
    { id: 'thisMonth', from: day(y, m, 1), to: day(y, m + 1, 0) },
    { id: 'lastMonth', from: day(y, m - 1, 1), to: day(y, m, 0) },
    { id: 'thisYear', from: day(y, 0, 1), to: day(y, 11, 31) },
    { id: 'lastYear', from: day(y - 1, 0, 1), to: day(y - 1, 11, 31) },
  ]
}
