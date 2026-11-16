/**
 * The number, date and folder tokens of the search grammar. Pure: the same text gives the same
 * filter, so a recent or saved search asks the same question again. (A date reads in the zone of
 * the browser that runs it: "your time zone", on purpose.)
 */

/** Why a token that looks like a filter cannot be applied. Each one has a `search.problem.*` text. */
export type SearchProblem =
  | 'number'
  | 'equals'
  | 'reversed'
  | 'unitOnce'
  | 'spaces'
  | 'reservedKey'
  | 'date'
  | 'folder'
  | 'once'
  | 'inAndParent'

export type NumberOp = '>=' | '<=' | 'range'

export interface NumberRange {
  key: string
  op: NumberOp
  gte?: number
  lte?: number
  unit?: string
}

export interface DateRange {
  from?: number
  to?: number
}

/** The prefixes that always win over a property key of the same name. */
export const RESERVED_PREFIXES = [
  'deleted',
  'template',
  'prop',
  'value',
  'name',
  'createdBy',
  'parent',
  'created',
  'updated',
  'in',
] as const

const RESERVED = new Set(RESERVED_PREFIXES.map((p) => p.toLowerCase()))

export function startsWithPrefix(token: string): boolean {
  const lower = token.toLowerCase()
  return RESERVED_PREFIXES.some((p) => lower.startsWith(`${p.toLowerCase()}:`))
}

/**
 * A number the way the node reads a stored value (`parseNumberToken`, io2p-core
 * `shared/entity.normalize.ts`): with both separators the last is the decimal mark, one separator
 * repeated is grouping, a lone separator is the decimal mark. An exponent is refused here although
 * the node's `Number()` reads it: a bound the user did not mean to write.
 */
export function readNumber(text: string): number | null {
  if (!/^[+-]?\d[\d.,]*$/.test(text)) return null
  const finite = (s: string) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const hasDot = text.includes('.')
  const hasComma = text.includes(',')
  if (hasDot && hasComma) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.'
    const grouping = decimal === ',' ? '.' : ','
    return finite(text.split(grouping).join('').replace(decimal, '.'))
  }
  const sep = hasComma ? ',' : hasDot ? '.' : ''
  if (sep === '') return finite(text)
  const parts = text.split(sep)
  return finite(parts.length > 2 ? parts.join('') : parts.join('.'))
}

// The number stops at the first character that is not a digit or a separator, so `10m2` is 10 m2
// and `1kgCO2e` keeps its unit whole.
const NUMBER = String.raw`[+-]?\d[\d.,]*`
const UNIT = String.raw`[^\s\d.,+\-"<>=:≥≤][^\s"]*`
const VALUE_RE = new RegExp(`^(${NUMBER})(${UNIT})?$`, 'u')
const HEAD_RE = /^(?:"([^"]+)"|([^\s"<>:=≥≤]+))(>=|<=|≥|≤|>|<|:)(.*)$/su

export type NumberToken =
  | { kind: 'number'; range: NumberRange }
  | { kind: 'problem'; problem: SearchProblem }

function value(text: string): { n: number; unit?: string } | 'exponent' | null {
  const match = VALUE_RE.exec(text)
  if (!match) return null
  if (match[2] && /^e[+-]?\d/i.test(match[2])) return 'exponent'
  const n = readNumber(match[1])
  return n === null ? null : { n, unit: match[2] }
}

/**
 * A `key>2t`, `key<=5`, `"total mass">2` or `key:2..5t` token, a near miss of one (with the reason),
 * or null for plain text. A token quoted as a whole is text. A bare key needs a letter, so `1:2` and
 * `12:30` stay text.
 */
export function parseNumberToken(token: string): NumberToken | null {
  const head = HEAD_RE.exec(token)
  if (!head) return null
  const [, quoted, bare, rawOp, rest] = head
  if (bare !== undefined && !/\p{L}/u.test(bare)) return null
  const key = quoted ?? bare
  const op = rawOp === '≥' ? '>=' : rawOp === '≤' ? '<=' : rawOp

  if (op !== ':') {
    // `a>b`, `x<y`: no number, so it is text.
    if (!/^[+-]?\d/.test(rest)) return null
    if (bare !== undefined && RESERVED.has(bare.toLowerCase())) {
      return { kind: 'problem', problem: 'reservedKey' }
    }
    const v = value(rest)
    if (v === null || v === 'exponent')
      return { kind: 'problem', problem: 'number' }
    // `>` reads as "at least": the node's bounds are inclusive, and the pill says ≥.
    return {
      kind: 'number',
      range: {
        key,
        op: op.startsWith('>') ? '>=' : '<=',
        ...(op.startsWith('>') ? { gte: v.n } : { lte: v.n }),
        ...(v.unit && { unit: v.unit }),
      },
    }
  }

  // `:` reaches here only for keys that are not a prefix (the caller checks the prefixes first),
  // or for a quoted key.
  const dots = rest.indexOf('..')
  if (dots < 0) {
    // `mass:2` reads as "equals 2", which the node cannot do; `foo:bar` stays text.
    return /^[+-]?\d/.test(rest) ? { kind: 'problem', problem: 'equals' } : null
  }
  const left = rest.slice(0, dots)
  const right = rest.slice(dots + 2)
  if (left === '' && right === '') return { kind: 'problem', problem: 'number' }
  if (left !== '' && readNumber(left) === null) {
    const l = value(left)
    return {
      kind: 'problem',
      problem: l !== null && l !== 'exponent' && l.unit ? 'unitOnce' : 'number',
    }
  }
  let lte: number | undefined
  let unit: string | undefined
  if (right !== '') {
    const unitOnly = new RegExp(`^${UNIT}$`, 'u').test(right)
    if (unitOnly && left !== '') unit = right
    else {
      const r = value(right)
      if (r === null || r === 'exponent')
        return { kind: 'problem', problem: 'number' }
      lte = r.n
      unit = r.unit
    }
  }
  const gte = left === '' ? undefined : (readNumber(left) ?? undefined)
  if (gte !== undefined && lte !== undefined && gte > lte) {
    return { kind: 'problem', problem: 'reversed' }
  }
  return {
    kind: 'number',
    range: {
      key,
      op: 'range',
      ...(gte !== undefined && { gte }),
      ...(lte !== undefined && { lte }),
      ...(unit && { unit }),
    },
  }
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Local midnight of `YYYY-MM-DD`, or null for a day that does not exist (2026-02-30). */
function dayStart(text: string, offsetDays = 0): number | null {
  const match = DAY_RE.exec(text)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  // A new Date for the next day, not +24 h: a day of a clock change is 23 or 25 hours.
  return new Date(y, m - 1, d + offsetDays).getTime()
}

/**
 * `2026-11-01`, `2026-11-01..2026-11-30`, `..2026-11-30` or `2026-11-01..` as inclusive epoch-ms
 * bounds, from local midnight to the next local midnight − 1 ms (the zone of the list's "Created at"
 * column). Anything else, a reversed range or a day before 1970 is a problem.
 */
export function parseDateValue(
  text: string
):
  | { kind: 'date'; range: DateRange }
  | { kind: 'problem'; problem: SearchProblem } {
  const dots = text.indexOf('..')
  const [fromText, toText] =
    dots < 0 ? [text, text] : [text.slice(0, dots), text.slice(dots + 2)]
  if (fromText === '' && toText === '')
    return { kind: 'problem', problem: 'date' }
  const from = fromText === '' ? undefined : dayStart(fromText)
  const end = toText === '' ? undefined : dayStart(toText, 1)
  if (from === null || end === null) return { kind: 'problem', problem: 'date' }
  const to = end === undefined ? undefined : end - 1
  if ((from ?? 0) < 0 || (to !== undefined && to < 0)) {
    return { kind: 'problem', problem: 'date' }
  }
  if (from !== undefined && to !== undefined && from > to) {
    return { kind: 'problem', problem: 'reversed' }
  }
  return {
    kind: 'date',
    range: {
      ...(from !== undefined && { from }),
      ...(to !== undefined && { to }),
    },
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(text: string): boolean {
  return UUID_RE.test(text)
}

const OPERATOR_RE = /^(?:>=|<=|≥|≤|>|<)$/

/** A lone `>`, a word ending in one (`mass>`) or a number starting with one (`>2`). */
export function isSpacedOperator(
  word: string,
  op: string,
  number: string
): boolean {
  return /\p{L}/u.test(word) && OPERATOR_RE.test(op) && /^[+-]?\d/.test(number)
}

/**
 * The number filter as text the parser reads back to the same filter (the menu writes this). With
 * `forPeople`, ≥ and ≤ in place of `>=` and `<=`: `>` here includes the bound. The parser reads both.
 */
export function numberToken(range: NumberRange, forPeople = false): string {
  const key =
    /^[^\s"<>:=≥≤]+$/.test(range.key) &&
    /\p{L}/u.test(range.key) &&
    !RESERVED.has(range.key.toLowerCase())
      ? range.key
      : `"${range.key}"`
  const unit = range.unit ?? ''
  if (range.op === '>=')
    return `${key}${forPeople ? '≥' : '>='}${range.gte}${unit}`
  if (range.op === '<=')
    return `${key}${forPeople ? '≤' : '<='}${range.lte}${unit}`
  return `${key}:${range.gte ?? ''}..${range.lte ?? ''}${unit}`
}
