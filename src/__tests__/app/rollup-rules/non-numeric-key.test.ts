import { describe, it, expect } from 'vitest'

import { isCertainlyNonNumericKey } from '@/app/rollup-rules/lib/rollup-rule'
import { PROPERTY_DICTIONARY } from '@/constants/property-dictionary'

/**
 * The warning is only useful while it never cries wolf. A false positive on a
 * summable key teaches the user to dismiss it, which costs more than staying
 * silent — so the numeric list is asserted member by member.
 */
const SUMMABLE = [
  'weight',
  'mass',
  'net-weight',
  'gross-weight',
  'height',
  'width',
  'length',
  'depth',
  'thickness',
  'diameter',
  'volume',
  'area',
  'density',
  'capacity',
  'quantity',
  'price',
  'cost',
  'power',
  'energy-consumption',
  'water-consumption',
  'waste',
  'co2-equivalent',
  'recycled-content',
  'recyclability',
  'lifespan-years',
  'duration',
  'batch-size',
  'floor',
]

const TEXT = [
  'address',
  'notes',
  'description',
  'name',
  'color',
  'status',
  'owner',
  'email',
  'material',
  'manufacturer',
  'serial-number',
  'barcode',
  'city',
  'country',
  'currency',
  'ifc-class',
]

describe('isCertainlyNonNumericKey', () => {
  it.each(SUMMABLE)('stays quiet on %s', (key) => {
    expect(isCertainlyNonNumericKey(key)).toBe(false)
  })

  it.each(TEXT)('warns on %s', (key) => {
    expect(isCertainlyNonNumericKey(key)).toBe(true)
  })

  it('stays quiet on a key the dictionary does not know', () => {
    // An unbounded key is free text as often as a number; silence is the only
    // honest answer, and it is what keeps a custom key usable.
    expect(isCertainlyNonNumericKey('test')).toBe(false)
    expect(isCertainlyNonNumericKey('concrete-mass')).toBe(false)
  })

  it('classifies every dictionary key without throwing', () => {
    for (const entry of PROPERTY_DICTIONARY) {
      expect(typeof isCertainlyNonNumericKey(entry.key)).toBe('boolean')
    }
  })

  it('warns on a date-shaped key only when it is not summable', () => {
    // `lifecycle` holds both: dates that cannot be summed and durations that can.
    // The category is therefore NOT listed wholesale, so dates stay quiet — a
    // deliberate under-warn rather than a wrong warn.
    expect(isCertainlyNonNumericKey('lifespan-years')).toBe(false)
    expect(isCertainlyNonNumericKey('duration')).toBe(false)
  })
})
