import { type NumberRange, numberToken, readNumber } from './search-grammar'
import {
  filtersToDisplayString,
  parseSearchQuery,
  type ParsedSearch,
  type SearchFilter,
} from './search-parser'

/** The fields of the "Add filter" panel, as typed. */
export interface PanelValues {
  numberKey: string
  numberFrom: string
  numberTo: string
  numberUnit: string
  propertyKey: string
  propertyValue: string
  createdFrom: string
  createdTo: string
  updatedFrom: string
  updatedTo: string
  createdBy: { id: string; name: string } | null
  deleted: '' | 'true' | 'false' | 'all'
  folder: { id: string; name: string } | null
}

export type PanelField = keyof PanelValues

export type PanelError =
  'numberKey' | 'numberValue' | 'numberReversed' | 'quote' | 'dateReversed'

const RANGED: ReadonlySet<SearchFilter['type']> = new Set([
  'number',
  'created',
  'updated',
  'folder',
])

const fromISO = (ms: number | undefined) => {
  if (ms === undefined) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const last = (parsed: ParsedSearch, type: SearchFilter['type']) =>
  parsed.filters.find((f) => f.type === type && !f.problem)

/** The panel opens with the filters the search already has, so Apply edits them. */
export function panelValuesOf(parsed: ParsedSearch): PanelValues {
  const number = last(parsed, 'number')?.number
  const created = last(parsed, 'created')?.range
  const updated = last(parsed, 'updated')?.range
  const createdBy = last(parsed, 'createdBy')
  const deleted = last(parsed, 'deleted')
  const folder = last(parsed, 'folder')
  return {
    numberKey: number?.key ?? '',
    numberFrom: number?.gte === undefined ? '' : String(number.gte),
    numberTo: number?.lte === undefined ? '' : String(number.lte),
    numberUnit: number?.unit ?? '',
    propertyKey: '',
    propertyValue: '',
    createdFrom: fromISO(created?.from),
    // `to` is the last ms of its day, so it reads back as that day.
    createdTo: fromISO(created?.to),
    updatedFrom: fromISO(updated?.from),
    updatedTo: fromISO(updated?.to),
    createdBy: createdBy ? { id: createdBy.value, name: '' } : null,
    deleted: (deleted?.value as PanelValues['deleted']) ?? '',
    folder: folder ? { id: folder.value, name: '' } : null,
  }
}

const needsQuotes = (text: string) => /[\s"=:]/.test(text)
const quoted = (text: string) => (needsQuotes(text) ? `"${text}"` : text)

function dayToken(prefix: string, from: string, to: string): string | null {
  if (!from && !to) return null
  if (from && from === to) return `${prefix}:${from}`
  return `${prefix}:${from}..${to}`
}

/**
 * The search text the panel's values give: the managed filters of `parsed` are replaced, a new
 * property is added, everything else stays as typed. The parser reads the text back, so the menu and
 * a typed token are one request. `ranges` is false on a list that takes no numbers, dates or folder.
 */
export function panelQuery(
  parsed: ParsedSearch,
  values: PanelValues,
  ranges: boolean
): { query: string } | { errors: Partial<Record<PanelField, PanelError>> } {
  const errors: Partial<Record<PanelField, PanelError>> = {}
  const tokens: string[] = []

  if (ranges) {
    const hasNumber = values.numberFrom.trim() || values.numberTo.trim()
    const key = values.numberKey.trim()
    if (hasNumber || key) {
      const gte = values.numberFrom.trim()
        ? readNumber(values.numberFrom.trim())
        : undefined
      const lte = values.numberTo.trim()
        ? readNumber(values.numberTo.trim())
        : undefined
      if (!key) errors.numberKey = 'numberKey'
      else if (key.includes('"')) errors.numberKey = 'quote'
      if (gte === null) errors.numberFrom = 'numberValue'
      if (lte === null) errors.numberTo = 'numberValue'
      if (!hasNumber) errors.numberFrom = 'numberValue'
      if (typeof gte === 'number' && typeof lte === 'number' && gte > lte) {
        errors.numberTo = 'numberReversed'
      }
      if (Object.keys(errors).length === 0) {
        // The node removes spaces from a unit, so `kg CO2e` is `kgCO2e`.
        const unit = values.numberUnit.replace(/\s+/g, '') || undefined
        const range: NumberRange =
          gte !== undefined && lte !== undefined
            ? { key, op: 'range', gte: gte!, lte: lte!, unit }
            : gte !== undefined
              ? { key, op: '>=', gte: gte!, unit }
              : { key, op: '<=', lte: lte!, unit }
        tokens.push(numberToken(range))
      }
    }
    for (const [field, from, to] of [
      ['created', values.createdFrom, values.createdTo],
      ['updated', values.updatedFrom, values.updatedTo],
    ] as const) {
      if (from && to && from > to) errors[`${field}To`] = 'dateReversed'
      else {
        const token = dayToken(field, from, to)
        if (token) tokens.push(token)
      }
    }
    if (values.folder) tokens.push(`in:${values.folder.id}`)
  }

  const propertyKey = values.propertyKey.trim()
  if (propertyKey) {
    const propertyValue = values.propertyValue.trim()
    if (propertyKey.includes('"')) errors.propertyKey = 'quote'
    else if (propertyValue.includes('"')) errors.propertyValue = 'quote'
    else {
      tokens.push(
        propertyValue
          ? `prop:${quoted(propertyKey)}=${quoted(propertyValue)}`
          : `prop:${quoted(propertyKey)}`
      )
    }
  }
  if (values.createdBy) tokens.push(`createdBy:${values.createdBy.id}`)
  if (values.deleted) tokens.push(`deleted:${values.deleted}`)

  if (Object.keys(errors).length > 0) return { errors }

  // A token the panel could not show (`mass:2`) stays as typed, with its note, unless the panel
  // writes one of its kind: Apply never deletes text the user did not see.
  const written = new Set(
    parseSearchQuery(tokens.join(' ')).filters.map((f) => f.type)
  )
  const managed = (f: SearchFilter) =>
    (f.type === 'createdBy' ||
      f.type === 'deleted' ||
      (ranges && RANGED.has(f.type))) &&
    (!f.problem || written.has(f.type))
  const kept = filtersToDisplayString(parsed.filters.filter((f) => !managed(f)))
  return { query: [kept, ...tokens].filter(Boolean).join(' ') }
}
