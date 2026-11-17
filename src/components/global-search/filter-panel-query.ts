import {
  isUnit,
  type NumberRange,
  numberToken,
  readNumber,
} from './search-grammar'
import {
  parseSearchQuery,
  type ParsedSearch,
  queryWithout,
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
  | 'numberKey'
  | 'numberValue'
  | 'numberUnit'
  | 'numberReversed'
  | 'quote'
  | 'dateReversed'

/** The filter kinds the panel replaces. A property is only ever added. */
export type PanelKind =
  'number' | 'created' | 'updated' | 'folder' | 'createdBy' | 'deleted'

export const PANEL_KINDS: ReadonlySet<PanelKind> = new Set([
  'number',
  'created',
  'updated',
  'folder',
  'createdBy',
  'deleted',
])

const RANGED: ReadonlySet<SearchFilter['type']> = new Set([
  'number',
  'created',
  'updated',
  'folder',
])

/** The kind a field edits, or null for the property fields. */
export function kindOf(field: PanelField): PanelKind | null {
  if (field.startsWith('number')) return 'number'
  if (field === 'createdFrom' || field === 'createdTo') return 'created'
  if (field === 'updatedFrom' || field === 'updatedTo') return 'updated'
  if (field.startsWith('property')) return null
  return field as PanelKind
}

const fromISO = (ms: number | undefined) => {
  if (ms === undefined) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The first one of a kind is the one the search applies; a second one is 'once'.
const applied = (parsed: ParsedSearch, type: SearchFilter['type']) =>
  parsed.filters.find((f) => f.type === type && !f.problem)

/** The panel opens with the filters the search already has, so Apply edits them. */
export function panelValuesOf(parsed: ParsedSearch): PanelValues {
  const number = applied(parsed, 'number')?.number
  const created = applied(parsed, 'created')?.range
  const updated = applied(parsed, 'updated')?.range
  const createdBy = applied(parsed, 'createdBy')
  const deleted = applied(parsed, 'deleted')
  const folder = applied(parsed, 'folder')
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
 * The search text the panel's values give. Only the kinds in `touched` change: their filters in
 * `query` are replaced, the other kinds stay as typed, and a new property is added. The input stays
 * editable while the panel is open, so a token typed after it opened is not in `values`: replacing
 * an untouched kind would delete it unseen. The parser reads the result back, so the menu and a
 * typed token are one request. `ranges` is false on a list that takes no numbers, dates or folder.
 */
export function panelQuery(
  query: string,
  values: PanelValues,
  ranges: boolean,
  touched: ReadonlySet<PanelKind> = PANEL_KINDS
): { query: string } | { errors: Partial<Record<PanelField, PanelError>> } {
  const errors: Partial<Record<PanelField, PanelError>> = {}
  const tokens: string[] = []
  const edits = (kind: PanelKind) =>
    touched.has(kind) && (ranges || !RANGED.has(kind))

  if (edits('number')) {
    const hasNumber = values.numberFrom.trim() || values.numberTo.trim()
    const key = values.numberKey.trim()
    if (hasNumber || key) {
      const gte = values.numberFrom.trim()
        ? readNumber(values.numberFrom.trim())
        : undefined
      const lte = values.numberTo.trim()
        ? readNumber(values.numberTo.trim())
        : undefined
      // The node removes spaces from a unit, so `kg CO2e` is `kgCO2e`.
      const unit = values.numberUnit.replace(/\s+/g, '') || undefined
      if (!key) errors.numberKey = 'numberKey'
      else if (key.includes('"')) errors.numberKey = 'quote'
      if (gte === null) errors.numberFrom = 'numberValue'
      if (lte === null) errors.numberTo = 'numberValue'
      if (!hasNumber) errors.numberFrom = 'numberValue'
      if (unit && !isUnit(unit)) errors.numberUnit = 'numberUnit'
      if (typeof gte === 'number' && typeof lte === 'number' && gte > lte) {
        errors.numberTo = 'numberReversed'
      }
      if (Object.keys(errors).length === 0) {
        const range: NumberRange =
          gte !== undefined && lte !== undefined
            ? { key, op: 'range', gte: gte!, lte: lte!, unit }
            : gte !== undefined
              ? { key, op: '>=', gte: gte!, unit }
              : { key, op: '<=', lte: lte!, unit }
        tokens.push(numberToken(range))
      }
    }
  }
  for (const [kind, from, to] of [
    ['created', values.createdFrom, values.createdTo],
    ['updated', values.updatedFrom, values.updatedTo],
  ] as const) {
    if (!edits(kind)) continue
    if (from && to && from > to) errors[`${kind}To`] = 'dateReversed'
    else {
      const token = dayToken(kind, from, to)
      if (token) tokens.push(token)
    }
  }
  if (edits('folder') && values.folder) tokens.push(`in:${values.folder.id}`)

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
  if (edits('createdBy') && values.createdBy) {
    tokens.push(`createdBy:${values.createdBy.id}`)
  }
  if (edits('deleted') && values.deleted) {
    tokens.push(`deleted:${values.deleted}`)
  }

  if (Object.keys(errors).length > 0) return { errors }

  // A token the panel could not show (`mass:2`) stays as typed, with its note, unless the panel
  // writes one of its kind: Apply never deletes text the user did not see.
  const written = new Set(
    parseSearchQuery(tokens.join(' ')).filters.map((f) => f.type)
  )
  const replaced = (f: SearchFilter) =>
    edits(f.type as PanelKind) && (!f.problem || written.has(f.type))
  const kept = queryWithout(query, replaced)
  return { query: [kept, ...tokens].filter(Boolean).join(' ') }
}
