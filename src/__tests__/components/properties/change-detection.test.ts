import { describe, it, expect } from 'vitest'

import {
  hasPropertyChanged,
  getChangedProperties,
} from '@/components/properties/utils/change-detection'
import type { Property } from '@/components/properties/types'

const makeProperty = (overrides: Partial<Property> = {}): Property => ({
  uuid: 'prop-uuid-1',
  key: 'width',
  values: [{ value: '10' }],
  ...overrides,
})

const makeOriginals = (overrides: Partial<Property>[] = [{}]): Property[] =>
  overrides.map((o, i) => makeProperty({ uuid: `prop-uuid-${i}`, ...o }))

describe('change-detection utilities', () => {
  describe('hasPropertyChanged', () => {
    it('detects new properties', () => {
      const prop = makeProperty({ _isNew: true, uuid: undefined })
      expect(hasPropertyChanged(prop, [])).toBe(true)
    })

    it('detects deleted properties', () => {
      const prop = makeProperty({ _deleted: true })
      expect(hasPropertyChanged(prop, [makeProperty()])).toBe(true)
    })

    it('detects modified flag', () => {
      const prop = makeProperty({ _modified: true })
      expect(hasPropertyChanged(prop, [makeProperty()])).toBe(true)
    })

    it('returns false when property is unchanged', () => {
      const original = makeProperty()
      const edited = makeProperty()
      expect(hasPropertyChanged(edited, [original])).toBe(false)
    })

    it('detects key change', () => {
      const original = makeProperty({ key: 'width' })
      const edited = makeProperty({ key: 'height' })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects added values', () => {
      const original = makeProperty({ values: [{ value: '10' }] })
      const edited = makeProperty({
        values: [{ value: '10' }, { value: '20' }],
      })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects removed values', () => {
      const original = makeProperty({
        values: [{ value: '10' }, { value: '20' }],
      })
      const edited = makeProperty({ values: [{ value: '10' }] })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects value content change', () => {
      const original = makeProperty({ values: [{ value: '10' }] })
      const edited = makeProperty({ values: [{ value: '20' }] })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects text-to-formula transition', () => {
      const original = makeProperty({ values: [{ value: '10' }] })
      const edited = makeProperty({
        values: [
          {
            value: '10',
            formulaData: {
              formula: 'x + y',
              formulaUuid: 'formula-1',
              result: null,
            },
          },
        ],
      })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects formula-to-text transition', () => {
      const original = makeProperty({
        values: [
          {
            value: '10',
            formulaData: {
              formula: 'x + y',
              formulaUuid: 'formula-1',
              result: null,
            },
          },
        ],
      })
      const edited = makeProperty({ values: [{ value: '10' }] })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('detects formula UUID change', () => {
      const original = makeProperty({
        values: [
          {
            value: '10',
            formulaData: {
              formula: 'x + y',
              formulaUuid: 'formula-1',
              result: null,
            },
          },
        ],
      })
      const edited = makeProperty({
        values: [
          {
            value: '10',
            formulaData: {
              formula: 'a * b',
              formulaUuid: 'formula-2',
              result: null,
            },
          },
        ],
      })
      expect(hasPropertyChanged(edited, [original])).toBe(true)
    })

    it('returns false when formula is unchanged', () => {
      const formulaData = {
        formula: 'x + y',
        formulaUuid: 'formula-1',
        result: null as number | null,
      }
      const original = makeProperty({
        values: [{ value: '10', formulaData }],
      })
      const edited = makeProperty({
        values: [{ value: '10', formulaData }],
      })
      expect(hasPropertyChanged(edited, [original])).toBe(false)
    })

    it('returns false when property UUID not found in originals', () => {
      const prop = makeProperty({ uuid: 'not-in-originals' })
      const originals = [makeProperty({ uuid: 'other-uuid' })]
      expect(hasPropertyChanged(prop, originals)).toBe(false)
    })

    it('handles properties with empty values array', () => {
      const original = makeProperty({ values: [] })
      const edited = makeProperty({ values: [] })
      expect(hasPropertyChanged(edited, [original])).toBe(false)
    })
  })

  describe('getChangedProperties', () => {
    it('returns only changed properties', () => {
      const originals = makeOriginals([
        { key: 'width', values: [{ value: '10' }] },
        { key: 'height', values: [{ value: '20' }] },
      ])
      const edited: Property[] = [
        { ...originals[0], key: 'changed-width' }, // changed
        { ...originals[1] }, // unchanged
      ]

      const result = getChangedProperties(edited, originals)
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('changed-width')
    })

    it('returns empty array when nothing changed', () => {
      const originals = makeOriginals([{ key: 'width' }])
      const result = getChangedProperties([...originals], originals)
      expect(result).toHaveLength(0)
    })

    it('includes new, deleted, and modified properties', () => {
      const originals = makeOriginals([{ key: 'width' }])
      const edited: Property[] = [
        { ...originals[0], _modified: true },
        makeProperty({ uuid: undefined, _isNew: true, key: 'new-prop' }),
      ]

      const result = getChangedProperties(edited, originals)
      expect(result).toHaveLength(2)
    })
  })
})
