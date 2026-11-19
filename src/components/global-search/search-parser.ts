/**
 * Advanced Search Parser
 *
 * Parses search queries with special syntax into filters. `toListParams` turns them into the query
 * a list sends to the node.
 *
 * Supported syntax:
 * - `deleted:true`, `deleted:false` or `deleted:all` - Only, without or with soft-deleted items
 * - `template:true` or `template:false` - Filter by template status
 * - `prop:label` - Search by property label only (any value)
 * - `prop:label=value` - Search by property label AND value
 * - `value:xyz` - Search by property value only (any property)
 * - `name:value` or `name:"multi word"` - Search by object name (quotes optional)
 * - `createdBy:uuid` - Filter by creator UUID
 * - `parent:uuid` - Filter by parent UUID
 * - `mass>=2t`, `mass<=5`, `mass:2..5t`, `"total mass">2` - A number range (objects only)
 * - `created:2026-11-01`, `updated:2026-11-01..2026-11-30` - A day or days (objects only)
 * - `in:uuid` - Everything inside a folder, at any depth (objects only)
 * - Regular text becomes the searchTerm
 *
 * Examples (as list params):
 * - "deleted:true battery" → { deleted: 'only', q: 'battery' }
 * - "prop:material=steel" → { property: ['material:steel'] }
 * - "prop:material" → { property: ['material'] } (any value)
 * - "value:steel" → { property: [':steel'] } (any property)
 * - 'name:"Clay Tile"' → { q: 'Clay Tile' }
 */

import { capSearch, type SearchKind, searchInput } from '@/lib/search-text'

import {
  type DateRange,
  isSpacedOperator,
  isUuid,
  knowsUnit,
  type NumberRange,
  numberToken,
  parseDateValue,
  parseNumberToken,
  PLAIN_GRAMMAR,
  type SearchGrammar,
  type SearchProblem,
  startsWithPrefix,
  unitKey,
} from './search-grammar'

export interface SearchFilter {
  type:
    | 'deleted'
    | 'template'
    | 'property'
    | 'propertyLabel'
    | 'propertyValue'
    | 'name'
    | 'createdBy'
    | 'parent'
    | 'number'
    | 'created'
    | 'updated'
    | 'folder'
    | 'text'
  label: string
  value: string
  raw: string // Original input token
  // For property filters, store the key and value separately
  propertyKey?: string
  propertyValue?: string
  number?: NumberRange
  range?: DateRange
  /** Set when the token looks like a filter but cannot be applied: it is never sent. */
  problem?: SearchProblem
}

export interface ParsedSearch {
  searchTerm: string
  filters: SearchFilter[]
}

export interface FilterSuggestion {
  type: SearchFilter['type']
  prefix: string
  labelKey: string
  descriptionKey: string
  examples: string[]
  icon: string
}

// Available filter suggestions - uses translation keys for i18n
export const FILTER_SUGGESTIONS: FilterSuggestion[] = [
  {
    type: 'deleted',
    prefix: 'deleted:',
    labelKey: 'search.filters.deleted.label',
    descriptionKey: 'search.filters.deleted.description',
    examples: ['deleted:true', 'deleted:false'],
    icon: 'Trash2',
  },
  {
    type: 'property',
    prefix: 'prop:',
    labelKey: 'search.filters.property.label',
    descriptionKey: 'search.filters.property.description',
    examples: ['prop:material=steel', 'prop:status'],
    icon: 'Tag',
  },
  {
    type: 'propertyValue',
    prefix: 'value:',
    labelKey: 'search.filters.value.label',
    descriptionKey: 'search.filters.value.description',
    examples: ['value:steel', 'value:active'],
    icon: 'Hash',
  },
  {
    type: 'name',
    prefix: 'name:',
    labelKey: 'search.filters.name.label',
    descriptionKey: 'search.filters.name.description',
    examples: ['name:Battery', 'name:Clay Tile'],
    icon: 'Type',
  },
  {
    type: 'createdBy',
    prefix: 'createdBy:',
    labelKey: 'search.filters.createdBy.label',
    descriptionKey: 'search.filters.createdBy.description',
    examples: ['createdBy:abc-123-def'],
    icon: 'User',
  },
  {
    type: 'parent',
    prefix: 'parent:',
    labelKey: 'search.filters.parent.label',
    descriptionKey: 'search.filters.parent.description',
    examples: ['parent:abc-123-def'],
    icon: 'FolderTree',
  },
]

/** Where an unquoted `name:` stops: at any token that is a filter, a near miss included. */
function isFilterToken(token: string): boolean {
  return startsWithPrefix(token) || parseNumberToken(token) !== null
}

const unquote = (text: string) => text.replace(/^"|"$/g, '')

/** `key=value`, where either part may be quoted: `"stainless steel"="grade a"`. */
function splitProperty(text: string): { key: string; value?: string } {
  const quotedKey = /^"([^"]*)"(?:=(.*))?$/s.exec(text)
  if (quotedKey) {
    return quotedKey[2] === undefined
      ? { key: quotedKey[1] }
      : { key: quotedKey[1], value: unquote(quotedKey[2]) }
  }
  const eq = text.indexOf('=')
  return eq > 0
    ? { key: text.slice(0, eq), value: unquote(text.slice(eq + 1)) }
    : { key: text }
}

function numberFilter(
  token: string,
  grammar: SearchGrammar,
  raw = token
): SearchFilter | null {
  const parsed = parseNumberToken(token, grammar.decimalMark)
  if (parsed === null) return null
  if (parsed.kind !== 'number') {
    return {
      type: 'number',
      label: raw,
      value: raw,
      raw,
      problem: parsed.problem,
    }
  }
  const { unit } = parsed.range
  if (unit !== undefined && !knowsUnit(grammar, unit)) {
    return { type: 'number', label: raw, value: raw, raw, problem: 'unit' }
  }
  return {
    type: 'number',
    label: numberToken(parsed.range, true, grammar.decimalMark),
    value: numberToken(parsed.range),
    raw,
    number: parsed.range,
  }
}

// The words after `name:` or `value:` up to the next filter, unless the value is quoted.
function collectWords(
  tokens: string[],
  i: number,
  first: string
): { words: string[]; raw: string; next: number } {
  const words = first ? [first.replace(/^"|"$/g, '')] : []
  let raw = tokens[i]
  let next = i + 1
  if (!first.startsWith('"')) {
    while (next < tokens.length && !isFilterToken(tokens[next])) {
      words.push(tokens[next].replace(/^"|"$/g, ''))
      raw += ' ' + tokens[next]
      next++
    }
  }
  return { words, raw, next }
}

/**
 * Parse a search query into structured parts
 */
export function parseSearchQuery(
  query: string,
  grammar: SearchGrammar = PLAIN_GRAMMAR
): ParsedSearch {
  const filters: SearchFilter[] = []
  const textParts: string[] = []

  // Split by spaces, but respect quoted strings
  const tokens = tokenizeQuery(query)

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    const lowerToken = token.toLowerCase()

    // Check for deleted: filter (only true/false)
    if (lowerToken.startsWith('deleted:')) {
      const value = token.slice(8).toLowerCase()
      filters.push({
        type: 'deleted',
        label: `Deleted: ${value}`,
        value,
        raw: token,
        ...(!['true', 'false', 'all'].includes(value) && {
          problem: 'deleted' as const,
        }),
      })
      i++
      continue
    }

    // Check for template: filter (only true/false)
    if (lowerToken.startsWith('template:')) {
      const value = token.slice(9).toLowerCase()
      filters.push({
        type: 'template',
        label: `Template: ${value}`,
        value,
        raw: token,
        ...(!['true', 'false'].includes(value) && {
          problem: 'template' as const,
        }),
      })
      i++
      continue
    }

    // Check for prop: filter (format: prop:label or prop:label=value)
    if (lowerToken.startsWith('prop:')) {
      const { key: label, value } = splitProperty(token.slice(5))

      if (token.slice(5).startsWith('=')) {
        filters.push({
          type: 'property',
          label: token,
          value: token,
          raw: token,
          problem: 'property',
        })
      } else if (label && value !== undefined) {
        filters.push({
          type: 'property',
          label: `${label}: ${value}`,
          value: `${label}=${value}`,
          raw: token,
          propertyKey: label,
          propertyValue: value,
        })
      } else if (label.trim()) {
        filters.push({
          type: 'propertyLabel',
          label: `Property: ${label}`,
          value: label,
          raw: token,
          propertyKey: label.trim(),
        })
      }
      i++
      continue
    }

    // Check for value: filter (search by property value only)
    if (lowerToken.startsWith('value:')) {
      const { words, raw, next } = collectWords(
        tokens,
        i,
        token.slice(6).trim()
      )
      const value = words.join(' ').trim()
      if (value) {
        filters.push({
          type: 'propertyValue',
          label: `Value: ${value}`,
          value: value,
          raw,
          propertyValue: value,
        })
      }
      i = next
      continue
    }

    // Check for name: filter - collect all subsequent non-filter tokens
    if (lowerToken.startsWith('name:')) {
      const nameParts: string[] = []
      let nameRaw = token

      // Get the first part after name:
      const firstPart = token.slice(5).replace(/^"|"$/g, '')
      if (firstPart) {
        nameParts.push(firstPart)
      }

      // If the first part is quoted, we're done
      if (!token.slice(5).startsWith('"')) {
        // Not quoted, collect subsequent tokens until we hit another filter
        i++
        while (i < tokens.length && !isFilterToken(tokens[i])) {
          nameParts.push(tokens[i].replace(/^"|"$/g, ''))
          nameRaw += ' ' + tokens[i]
          i++
        }
        i-- // Back up one since the loop will increment
      }

      const nameValue = nameParts.join(' ').trim()
      if (nameValue) {
        filters.push({
          type: 'name',
          label: `Name: ${nameValue}`,
          value: nameValue,
          raw: nameRaw,
        })
      }
      i++
      continue
    }

    // Check for createdBy: filter
    if (lowerToken.startsWith('createdby:')) {
      const value = token.slice(10)
      filters.push({
        type: 'createdBy',
        label: `Created by: ${value.slice(0, 8)}...`,
        value,
        raw: token,
      })
      i++
      continue
    }

    // Check for parent: filter
    if (lowerToken.startsWith('parent:')) {
      const value = token.slice(7)
      filters.push({
        type: 'parent',
        label: `Parent: ${value.slice(0, 8)}...`,
        value,
        raw: token,
        ...(!isUuid(value) && { problem: 'parent' as const }),
      })
      i++
      continue
    }

    if (
      lowerToken.startsWith('created:') ||
      lowerToken.startsWith('updated:')
    ) {
      const type = lowerToken.startsWith('created:') ? 'created' : 'updated'
      const parsed = parseDateValue(token.slice(8))
      filters.push({
        type,
        label: token,
        value: token.slice(8),
        raw: token,
        ...(parsed.kind === 'date'
          ? { range: parsed.range }
          : { problem: parsed.problem }),
      })
      i++
      continue
    }

    if (lowerToken.startsWith('in:')) {
      const value = token.slice(3)
      filters.push({
        type: 'folder',
        label: token,
        value,
        raw: token,
        ...(!isUuid(value) && { problem: 'folder' as const }),
      })
      i++
      continue
    }

    const number = numberFilter(token, grammar)
    if (number) {
      // `mass>2 t` would apply without its unit: a 2 kg row would match.
      const next = tokens[i + 1]
      if (
        number.number &&
        number.number.unit === undefined &&
        next !== undefined &&
        grammar.units?.has(unitKey(next))
      ) {
        const raw = `${token} ${next}`
        filters.push({
          type: 'number',
          label: raw,
          value: raw,
          raw,
          problem: 'spaces',
        })
        i += 2
        continue
      }
      filters.push(number)
      i++
      continue
    }

    // `mass > 2`, `mass> 2`, `mass >2`: the user meant a number filter; say how to write it.
    const spaced = spacedNumber(tokens, i)
    if (spaced) {
      filters.push(spaced.filter)
      i += spaced.length
      continue
    }

    // Regular text
    if (token.trim()) {
      textParts.push(token.replace(/^"|"$/g, ''))
      filters.push({
        type: 'text',
        label: token,
        value: token,
        raw: token,
      })
    }
    i++
  }

  return {
    searchTerm: textParts.join(' '),
    filters,
  }
}

function spacedNumber(
  tokens: string[],
  i: number
): { filter: SearchFilter; length: number } | null {
  const [a, b = '', c = ''] = tokens.slice(i, i + 3)
  const split = (word: string) => /^(.*?)(>=|<=|≥|≤|>|<)$/su.exec(word)
  const lead = /^(>=|<=|≥|≤|>|<)(.+)$/su.exec(b)
  const candidates: [string, string, string, number][] = [
    [a, b, c, 3],
    ...(split(a)
      ? [[split(a)![1], split(a)![2], b, 2] as [string, string, string, number]]
      : []),
    ...(lead
      ? [[a, lead[1], lead[2], 2] as [string, string, string, number]]
      : []),
  ]
  for (const [word, op, number, length] of candidates) {
    if (isSpacedOperator(word, op, number)) {
      const raw = tokens.slice(i, i + length).join(' ')
      return {
        filter: {
          type: 'number',
          label: raw,
          value: raw,
          raw,
          problem: 'spaces',
        },
        length,
      }
    }
  }
  return null
}

export type SearchListType =
  'objects' | 'processes' | 'templates' | 'formulas' | 'constants' | 'shares'

const OTHER_LISTS: readonly SearchListType[] = [
  'processes',
  'templates',
  'formulas',
  'constants',
  'shares',
]

/**
 * The list a search started on `pathname` lands on: the list page itself, else objects (the same
 * rule as the search context; a `template:` token can still move it).
 */
export function searchListTypeOf(pathname: string): SearchListType {
  return OTHER_LISTS.find((type) => pathname === `/${type}`) ?? 'objects'
}

export interface ListSearchParams {
  q?: string
  property?: string[]
  createdBy?: string
  deleted?: 'only' | 'exclude' | 'include'
  parent?: string
  ancestor?: string
  numKey?: string
  numGte?: number
  numLte?: number
  numUnit?: string
  createdFrom?: number
  createdTo?: number
  updatedFrom?: number
  updatedTo?: number
}

export interface ListSearch {
  params: ListSearchParams
  /** Filters this list does not take. The node ignores an undeclared param, so they are left out. */
  unsupported: SearchFilter[]
  /** Filters that cannot be applied: a property key with a colon, an empty id, a `problem`. */
  invalid: SearchFilter[]
}

// Which params each list declares (io2p-client list query types). The node IGNORES a param a list
// does not declare, so sending one would return an unfiltered list that looks filtered.
const TAKES_PROPERTY: ReadonlySet<SearchListType> = new Set([
  'objects',
  'processes',
  'templates',
])
const TAKES_PARENT: ReadonlySet<SearchListType> = new Set(['objects'])
// The node takes numbers and dates on processes too; the product offers them on objects only.
const TAKES_RANGES: ReadonlySet<SearchListType> = new Set(['objects'])

/** Whether `search` narrows its list at all. A search whose every filter was left out does not. */
export function searchApplies(search: ListSearch | null): boolean {
  return search !== null && Object.keys(search.params).length > 0
}

/** What `search` asks of its list, as a value: equal for equal params, whatever object carries them. */
export function searchKey(search: ListSearch | null): string {
  return JSON.stringify(search?.params ?? null)
}

/**
 * The search fields of a list query. A `deleted:` token in the search wins over the page's "show
 * deleted" toggle, which the filter menu then shows as set by the search.
 */
export function listSearchQuery(
  search: ListSearch | null,
  showDeleted: boolean
): ListSearchParams {
  return {
    ...search?.params,
    deleted: search?.params.deleted ?? (showDeleted ? 'include' : undefined),
  }
}

/** `template:true|false` from the search, or undefined when it does not say. */
export function templateSearch(parsed: ParsedSearch): boolean | undefined {
  const filter = parsed.filters.findLast((f) => f.type === 'template')
  return filter ? filter.value === 'true' : undefined
}

/** How the node matches `q` on a list of `type`: shares match one substring, the rest the index. */
export function searchKindOf(type: SearchListType): SearchKind {
  return type === 'shares' ? 'substring' : 'words'
}

/** The free text of `parsed`, the part that becomes `q`. */
export function searchTextOf(parsed: ParsedSearch): string {
  return parsed.filters
    .flatMap((filter) =>
      filter.type === 'text'
        ? [filter.value.replace(/^"|"$/g, '')]
        : filter.type === 'name'
          ? [filter.value]
          : []
    )
    .join(' ')
}

/** The list query for `parsed` on a list of `type`. */
export function toListParams(
  parsed: ParsedSearch,
  type: SearchListType
): ListSearch {
  const params: ListSearchParams = {}
  const unsupported: SearchFilter[] = []
  const invalid: SearchFilter[] = []
  const property: string[] = []

  const seen = new Set<SearchFilter['type']>()
  const hasParent = parsed.filters.some(
    (f) => f.type === 'parent' && !f.problem
  )

  for (const filter of parsed.filters) {
    const ranged = ['number', 'created', 'updated', 'folder'].includes(
      filter.type
    )
    if (ranged && !TAKES_RANGES.has(type)) {
      unsupported.push(filter)
      continue
    }
    if (filter.problem) {
      invalid.push(filter)
      continue
    }
    if (ranged && seen.has(filter.type)) {
      invalid.push({ ...filter, problem: 'once' })
      continue
    }
    if (filter.type === 'folder' && hasParent) {
      invalid.push({ ...filter, problem: 'inAndParent' })
      continue
    }
    seen.add(filter.type)
    switch (filter.type) {
      case 'text':
      case 'name':
        // `searchTextOf` below. The node has no name-only filter; `q` matches name or description.
        break
      case 'property':
      case 'propertyLabel':
      case 'propertyValue': {
        if (!TAKES_PROPERTY.has(type)) {
          unsupported.push(filter)
          break
        }
        const key = filter.propertyKey ?? ''
        // The node splits `key:value` at the FIRST colon, so a key with a colon would match
        // a different key.
        if (key.includes(':')) {
          invalid.push(filter)
          break
        }
        property.push(
          filter.type === 'propertyLabel'
            ? key
            : `${key}:${filter.propertyValue ?? ''}`
        )
        break
      }
      case 'createdBy':
        if (filter.value) params.createdBy = filter.value
        else invalid.push(filter)
        break
      case 'deleted':
        params.deleted =
          filter.value === 'true'
            ? 'only'
            : filter.value === 'all'
              ? 'include'
              : 'exclude'
        break
      case 'number': {
        const range = filter.number!
        params.numKey = range.key
        if (range.gte !== undefined) params.numGte = range.gte
        if (range.lte !== undefined) params.numLte = range.lte
        if (range.unit) params.numUnit = range.unit
        break
      }
      case 'created':
      case 'updated': {
        const { from, to } = filter.range!
        if (from !== undefined) params[`${filter.type}From`] = from
        if (to !== undefined) params[`${filter.type}To`] = to
        break
      }
      case 'folder':
        params.ancestor = filter.value
        break
      case 'parent':
        if (!TAKES_PARENT.has(type)) unsupported.push(filter)
        else if (filter.value) params.parent = filter.value
        else invalid.push(filter)
        break
      case 'template':
        // Routing only: it picks /templates or /objects, it is not a list param.
        break
    }
  }

  const text = searchTextOf(parsed)
  const input = searchInput(text, searchKindOf(type))
  if (input.status === 'ok') params.q = input.q
  // Unreachable today: the command center is the only way a search is applied (no list reads `q`
  // from the URL), and it blocks this. Sending the words lets the node refuse them; dropping them
  // would list rows that look like matches.
  else if (input.status === 'refused' && input.problem === 'too-many-words') {
    params.q = capSearch(text)
  }
  if (property.length > 0) params.property = property
  return { params, unsupported, invalid }
}

/**
 * Tokenize a query string, respecting quoted strings
 */
function tokenizeQuery(query: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  // An odd quote (an inch mark, a typo) would otherwise swallow every filter after it as text.
  const quotes = [...query.matchAll(/"/g)].map((m) => m.index)
  const unmatched = quotes.length % 2 === 1 ? quotes.at(-1) : -1

  for (let i = 0; i < query.length; i++) {
    const char = query[i]

    if (char === '"' && i !== unmatched) {
      inQuotes = !inQuotes
      current += char
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    tokens.push(current.trim())
  }

  return tokens
}

/**
 * Get matching filter suggestions based on current input
 */
export function getFilterSuggestions(input: string): FilterSuggestion[] {
  if (!input) return FILTER_SUGGESTIONS

  const lowerInput = input.toLowerCase()

  // Check if user is typing a filter prefix
  // Note: labelKey matching is handled in the UI component with translations
  return FILTER_SUGGESTIONS.filter((suggestion) =>
    suggestion.prefix.startsWith(lowerInput)
  )
}

/**
 * The query with the filters `drop` names taken out. A token the parser read as no filter
 * (`deleted:maybe`, `prop:`) stays as typed, and number filters show as ≥/≤.
 */
export function queryWithout(
  query: string,
  drop: (filter: SearchFilter) => boolean,
  grammar: SearchGrammar = PLAIN_GRAMMAR
): string {
  const tokens = tokenizeQuery(query)
  const kept: string[] = []
  let i = 0
  for (const filter of parseSearchQuery(query, grammar).filters) {
    const length = tokenizeQuery(filter.raw).length
    const at = (n: number) => tokens.slice(n, n + length).join(' ')
    let start = i
    while (start < tokens.length && at(start) !== filter.raw) start++
    // Cannot happen (each raw is its own tokens, in order); kept safe, not lost.
    if (start === tokens.length) continue
    kept.push(...tokens.slice(i, start))
    if (!drop(filter)) kept.push(shown(filter))
    i = start + length
  }
  kept.push(...tokens.slice(i))
  return kept.join(' ')
}

/**
 * Build a display string from filters
 */
export function filtersToDisplayString(filters: SearchFilter[]): string {
  return filters.map(shown).join(' ')
}

/** A number filter as ≥/≤, since its `>` includes the bound; every other token as typed. */
function shown(filter: SearchFilter): string {
  return filter.number ? filter.label : filter.raw
}

/**
 * Remove a filter and rebuild the query
 */
export function removeFilter(
  filters: SearchFilter[],
  filterToRemove: SearchFilter
): string {
  return filters
    .filter((f) => f !== filterToRemove)
    .map(shown)
    .join(' ')
}
