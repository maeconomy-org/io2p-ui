import { describe, expect, it } from 'vitest'

import {
  type PanelValues,
  panelQuery,
  panelValuesOf,
} from '@/components/global-search/filter-panel-query'
import { unitKeys } from '@/components/global-search/search-grammar'
import {
  parseSearchQuery,
  toListParams,
} from '@/components/global-search/search-parser'

const EMPTY: PanelValues = panelValuesOf(parseSearchQuery(''))
const FOLDER = '0193a5c0-7d1e-7000-8000-000000000001'
const USER = '0193a5c0-7d1e-7000-8000-000000000002'

const params = (query: string) =>
  toListParams(parseSearchQuery(query), 'objects').params

const applied = (
  values: Partial<PanelValues>,
  start = '',
  ranges = true
): string => {
  const result = panelQuery(start, { ...EMPTY, ...values }, ranges)
  if (!('query' in result)) throw new Error(JSON.stringify(result.errors))
  return result.query
}

describe('panelQuery gives the request the typed token gives', () => {
  it.each<[string, Partial<PanelValues>, string]>([
    [
      'at least',
      { numberKey: 'mass', numberFrom: '2', numberUnit: 't' },
      'mass>=2t',
    ],
    ['at most', { numberKey: 'mass', numberTo: '5' }, 'mass<=5'],
    [
      'a range with a unit',
      { numberKey: 'mass', numberFrom: '2', numberTo: '5', numberUnit: 'kg' },
      'mass:2..5kg',
    ],
    ['a decimal comma', { numberKey: 'mass', numberFrom: '2,5' }, 'mass>=2.5'],
    [
      'a key with a space',
      { numberKey: 'total mass', numberFrom: '2' },
      '"total mass">=2',
    ],
    ['a key with a colon', { numberKey: 'a:b', numberTo: '1' }, '"a:b"<=1'],
    [
      'a key named like a filter',
      { numberKey: 'name', numberFrom: '1', numberTo: '3' },
      '"name":1..3',
    ],
    [
      'a unit with a space',
      { numberKey: 'co2', numberFrom: '1', numberUnit: 'kg CO2e' },
      'co2>=1kgCO2e',
    ],
    [
      'a property',
      { propertyKey: 'material', propertyValue: 'steel' },
      'prop:material=steel',
    ],
    [
      'a property with spaces',
      { propertyKey: 'stainless steel', propertyValue: 'grade a' },
      'prop:"stainless steel"="grade a"',
    ],
    ['a property name only', { propertyKey: 'material' }, 'prop:material'],
    [
      'one day',
      { createdFrom: '2026-11-01', createdTo: '2026-11-01' },
      'created:2026-11-01',
    ],
    [
      'days',
      { createdFrom: '2026-11-01', createdTo: '2026-11-30' },
      'created:2026-11-01..2026-11-30',
    ],
    ['from a day', { updatedFrom: '2026-11-01' }, 'updated:2026-11-01..'],
    ['up to a day', { updatedTo: '2026-11-30' }, 'updated:..2026-11-30'],
    ['a folder', { folder: { id: FOLDER, name: 'Hal' } }, `in:${FOLDER}`],
    [
      'a creator',
      { createdBy: { id: USER, name: 'Ann' } },
      `createdBy:${USER}`,
    ],
    ['deleted shown too', { deleted: 'all' }, 'deleted:all'],
    ['only deleted', { deleted: 'true' }, 'deleted:true'],
    ['deleted hidden', { deleted: 'false' }, 'deleted:false'],
  ])('%s', (_, values, typed) => {
    const query = applied(values)
    expect(params(query)).toEqual(params(typed))
    expect(params(query)).not.toEqual({})
  })
})

describe('panelQuery', () => {
  it('replaces the filters it manages and keeps the rest as typed', () => {
    expect(
      applied(
        { numberKey: 'length', numberFrom: '3' },
        'beton mass>2 prop:a=b deleted:true'
      )
    ).toBe('beton prop:a=b length>=3')
  })

  it('writes one day as that day, not as a range of one', () => {
    expect(
      applied({ createdFrom: '2026-11-01', createdTo: '2026-11-01' })
    ).toBe('created:2026-11-01')
  })

  it('keeps a token it could not show, unless it writes one of its kind', () => {
    expect(applied({ propertyKey: 'a' }, 'mass:2 created:today')).toBe(
      'mass:2 created:today prop:a'
    )
    expect(
      applied({ numberKey: 'mass', numberFrom: '2' }, 'mass:2 created:today')
    ).toBe('created:today mass>=2')
  })

  it('changes only the kinds the user edited in the panel', () => {
    const start = `mass>=5 deleted:true createdBy:${USER} created:2026-11-01`
    const values = { ...EMPTY, deleted: 'all' as const }
    const result = panelQuery(start, values, true, new Set(['deleted']))
    expect(result).toEqual({
      query: `mass≥5 createdBy:${USER} created:2026-11-01 deleted:all`,
    })
    expect(panelQuery(start, EMPTY, true, new Set())).toEqual({
      query: `mass≥5 deleted:true createdBy:${USER} created:2026-11-01`,
    })
  })

  it('does not check the fields of a kind the user did not edit', () => {
    const values = { ...EMPTY, numberFrom: '2t', deleted: 'true' as const }
    expect(panelQuery('', values, true, new Set(['deleted']))).toEqual({
      query: 'deleted:true',
    })
  })

  it('replaces a broken filter of a kind it writes, and keeps the rest as typed', () => {
    expect(
      applied({ deleted: 'true' }, 'deleted:maybe beton template:x prop:')
    ).toBe('beton template:x prop: deleted:true')
  })

  it('replaces every filter of a kind it writes, also a second one', () => {
    expect(
      applied({ numberKey: 'a', numberFrom: '1' }, 'mass>=2 beton length>=3')
    ).toBe('beton a>=1')
  })

  it('adds a property beside the ones the search has', () => {
    expect(applied({ propertyKey: 'c' }, 'prop:a=b')).toBe('prop:a=b prop:c')
  })

  it('keeps numbers, dates and folder as typed on a list without them', () => {
    expect(
      applied({ numberKey: 'x', numberFrom: '1' }, 'mass>2 beton', false)
    ).toBe('mass≥2 beton')
  })

  it('opens with the filters of the search, and gives them back the same', () => {
    const start = `mass:2..5t created:2026-11-01..2026-11-30 updated:2026-11-02 in:${FOLDER} createdBy:${USER} deleted:all beton`
    const values = panelValuesOf(parseSearchQuery(start))
    expect(params(applied(values, start))).toEqual(params(start))
  })

  it.each<[string, Partial<PanelValues>, Record<string, string>]>([
    [
      'a number with no property',
      { numberFrom: '2' },
      { numberKey: 'numberKey' },
    ],
    [
      'a property with no number',
      { numberKey: 'mass' },
      { numberFrom: 'numberValue' },
    ],
    [
      'a number that is not one',
      { numberKey: 'mass', numberFrom: '2t' },
      { numberFrom: 'numberValue' },
    ],
    [
      'an exponent',
      { numberKey: 'mass', numberTo: '1e3' },
      { numberTo: 'numberValue' },
    ],
    [
      'a reversed range',
      { numberKey: 'mass', numberFrom: '5', numberTo: '2' },
      { numberTo: 'numberReversed' },
    ],
    [
      'a quote in a key',
      { numberKey: 'a"b', numberFrom: '1' },
      { numberKey: 'quote' },
    ],
    [
      'a quote in a property',
      { propertyKey: 'a', propertyValue: 'x"y' },
      { propertyValue: 'quote' },
    ],
    [
      'a unit that starts with a digit',
      { numberKey: 'mass', numberFrom: '2', numberUnit: '2t' },
      { numberUnit: 'numberUnit' },
    ],
    [
      'a unit with a quote',
      { numberKey: 'mass', numberFrom: '2', numberUnit: 't"' },
      { numberUnit: 'numberUnit' },
    ],
    [
      'an exponent as a unit',
      { numberKey: 'mass', numberFrom: '2', numberUnit: 'e3' },
      { numberUnit: 'numberUnit' },
    ],
    [
      'reversed days',
      { createdFrom: '2026-11-30', createdTo: '2026-11-01' },
      { createdTo: 'dateReversed' },
    ],
  ])('refuses %s', (_, values, errors) => {
    const result = panelQuery('', { ...EMPTY, ...values }, true)
    expect(result).toEqual({ errors })
  })
})

describe('panelQuery and the units the node knows', () => {
  const grammar = {
    units: unitKeys(['t', 'kg', 'kgCO2e']),
    decimalMark: '.' as const,
  }
  const run = (numberUnit: string) =>
    panelQuery(
      '',
      { ...EMPTY, numberKey: 'mass', numberFrom: '2', numberUnit },
      true,
      undefined,
      grammar
    )

  it('refuses a unit the node does not know, before any request', () => {
    expect(run('°C')).toEqual({ errors: { numberUnit: 'numberUnit' } })
  })

  it('takes a known unit in any case, with spaces removed', () => {
    expect(run('KG CO2e')).toEqual({ query: 'mass>=2KGCO2e' })
  })
})

describe('panelQuery and a number grouped in thousands', () => {
  const dutch = { units: null, decimalMark: ',' } as const

  it('refuses 2.000 in a comma locale, which would be read as 2', () => {
    const values = { ...EMPTY, numberKey: 'mass', numberFrom: '2.000' }
    expect(panelQuery('', values, true, undefined, dutch)).toEqual({
      errors: { numberFrom: 'numberGrouping' },
    })
  })

  it('reads 2,000 in a comma locale as the decimal it is', () => {
    const values = { ...EMPTY, numberKey: 'mass', numberTo: '2,000' }
    expect(panelQuery('', values, true, undefined, dutch)).toEqual({
      query: 'mass<=2',
    })
  })
})
