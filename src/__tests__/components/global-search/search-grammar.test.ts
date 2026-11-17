import { describe, expect, it } from 'vitest'

import {
  isUnit,
  numberToken,
  parseDateValue,
  parseNumberToken,
  readNumber,
} from '@/components/global-search/search-grammar'

describe('readNumber', () => {
  it.each([
    ['2', 2],
    ['-2', -2],
    ['2.5', 2.5],
    ['2,5', 2.5],
    ['1.000', 1],
    ['1,000', 1],
    ['1.000.000', 1_000_000],
    ['1,000,000', 1_000_000],
    ['1.000,5', 1000.5],
    ['1,000.5', 1000.5],
    ['.5', 0.5],
    [',5', 0.5],
    ['-.5', -0.5],
  ])('reads %s as the node reads a stored value', (text, expected) => {
    expect(readNumber(text)).toBe(expected)
  })

  it.each(['1e3', '.', '', 'abc', '2t'])('refuses %s', (text) => {
    expect(readNumber(text)).toBeNull()
  })
})

const range = (token: string) => {
  const parsed = parseNumberToken(token)
  return parsed?.kind === 'number' ? parsed.range : parsed
}
const problem = (token: string) => {
  const parsed = parseNumberToken(token)
  return parsed?.kind === 'problem' ? parsed.problem : parsed
}

describe('parseNumberToken', () => {
  it.each([
    ['mass>2', { key: 'mass', op: '>=', gte: 2 }],
    ['mass>=2', { key: 'mass', op: '>=', gte: 2 }],
    ['mass≥2', { key: 'mass', op: '>=', gte: 2 }],
    ['mass<5', { key: 'mass', op: '<=', lte: 5 }],
    ['mass<=5', { key: 'mass', op: '<=', lte: 5 }],
    ['mass>2t', { key: 'mass', op: '>=', gte: 2, unit: 't' }],
    ['mass>=2.5kg', { key: 'mass', op: '>=', gte: 2.5, unit: 'kg' }],
    ['mass>=2,5kg', { key: 'mass', op: '>=', gte: 2.5, unit: 'kg' }],
    ['mass>-1', { key: 'mass', op: '>=', gte: -1 }],
    ['mass>=.5t', { key: 'mass', op: '>=', gte: 0.5, unit: 't' }],
    ['mass:,5..2', { key: 'mass', op: 'range', gte: 0.5, lte: 2 }],
    ['area>=10m2', { key: 'area', op: '>=', gte: 10, unit: 'm2' }],
    ['co2>=1kgCO2e', { key: 'co2', op: '>=', gte: 1, unit: 'kgCO2e' }],
    ['"total mass">2', { key: 'total mass', op: '>=', gte: 2 }],
    ['"name":2..5', { key: 'name', op: 'range', gte: 2, lte: 5 }],
    ['mass:2..5', { key: 'mass', op: 'range', gte: 2, lte: 5 }],
    ['mass:2..5t', { key: 'mass', op: 'range', gte: 2, lte: 5, unit: 't' }],
    ['mass:2..5m2', { key: 'mass', op: 'range', gte: 2, lte: 5, unit: 'm2' }],
    ['mass:..5t', { key: 'mass', op: 'range', lte: 5, unit: 't' }],
    ['mass:2..', { key: 'mass', op: 'range', gte: 2 }],
    ['mass:2..t', { key: 'mass', op: 'range', gte: 2, unit: 't' }],
    ['mass:2..2', { key: 'mass', op: 'range', gte: 2, lte: 2 }],
    ['ratio:1..2', { key: 'ratio', op: 'range', gte: 1, lte: 2 }],
  ])('reads %s', (token, expected) => {
    expect(range(token)).toEqual(expected)
  })

  it.each([
    ['co2 in a quoted token', '"co2>5"'],
    ['no number after >', 'a>b'],
    ['a key with no letter', '1:2'],
    ['a time', '12:30'],
    ['an unknown prefix', 'foo:bar'],
    ['plain text', 'beton'],
  ])('leaves %s as text', (_, token) => {
    expect(parseNumberToken(token)).toBeNull()
  })

  it.each([
    ['mass>1e3', 'number'],
    ['mass:1...5', 'number'],
    ['mass:..', 'number'],
    ['mass:2', 'equals'],
    ['mass:5..2', 'reversed'],
    ['mass:2t..5t', 'unitOnce'],
    ['name>2', 'reservedKey'],
    ['created>5', 'reservedKey'],
  ])('refuses %s with a reason', (token, reason) => {
    expect(problem(token)).toBe(reason)
  })

  it.each([
    { key: 'mass', op: '>=', gte: 2, unit: 't' },
    { key: 'mass', op: '<=', lte: 5 },
    { key: 'total mass', op: 'range', gte: 2, lte: 5, unit: 'kg' },
    { key: 'name', op: 'range', gte: 2 },
    { key: 'a:b', op: '>=', gte: -1.5 },
    { key: '123', op: '<=', lte: 4 },
  ] as const)('writes $key $op as a token that reads back the same', (r) => {
    expect(range(numberToken(r))).toEqual(r)
    expect(range(numberToken(r, true))).toEqual(r)
  })

  it.each(['t', 'm2', 'kgCO2e', '°C'])('takes %s as a unit', (unit) => {
    expect(isUnit(unit)).toBe(true)
  })

  it.each(['2t', '.t', '-t', '"t', 'e3', 't"'])(
    'refuses %s as a unit',
    (unit) => {
      expect(isUnit(unit)).toBe(false)
    }
  )

  it('shows >= as ≥ for people', () => {
    expect(
      numberToken({ key: 'mass', op: '>=', gte: 2, unit: 't' }, true)
    ).toBe('mass≥2t')
  })
})

const dates = (text: string) => {
  const parsed = parseDateValue(text)
  return parsed.kind === 'date' ? parsed.range : parsed.problem
}

// Midnights in Europe/Amsterdam, the zone vitest.config.ts sets.
const NOV_1 = 1793487600000
const NOV_2 = 1793574000000
const NOV_30 = 1795993200000
const DEC_1 = 1796079600000

describe('parseDateValue', () => {
  it('takes a day from local midnight to the next one, inclusive', () => {
    expect(dates('2026-11-01')).toEqual({ from: NOV_1, to: NOV_2 - 1 })
  })

  it.each([
    ['2026-10-25', 25],
    ['2026-03-29', 23],
  ])('takes the whole of %s, a day of %i hours', (day, hours) => {
    const r = dates(day) as { from: number; to: number }
    expect(r.to + 1 - r.from).toBe(hours * 3_600_000)
  })

  it('takes 1970-01-01 from epoch 0, which is after its local midnight here', () => {
    expect(dates('1970-01-01')).toEqual({ from: 0, to: 82_800_000 - 1 })
  })

  it.each([
    ['2026-11-01..2026-11-30', { from: NOV_1, to: DEC_1 - 1 }],
    ['..2026-11-30', { to: DEC_1 - 1 }],
    ['2026-11-30..', { from: NOV_30 }],
  ])('takes the range %s', (text, expected) => {
    expect(dates(text)).toEqual(expected)
  })

  it.each([
    ['2026-02-30', 'date'],
    ['2026-11-31', 'date'],
    ['01-11-2026', 'date'],
    ['today', 'date'],
    ['2026-11-1', 'date'],
    ['..', 'date'],
    ['1969-12-31', 'date'],
    ['1969-12-31..1970-01-02', 'date'],
    ['2026-11-30..2026-11-01', 'reversed'],
  ])('refuses %s', (text, reason) => {
    expect(dates(text)).toBe(reason)
  })
})
