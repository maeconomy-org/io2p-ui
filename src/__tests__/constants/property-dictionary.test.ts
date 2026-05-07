import { describe, it, expect } from 'vitest'

import {
  matchDictionary,
  resolvePropertyLabel,
  getDictionaryEntry,
  getValuePlaceholder,
} from '@/constants/property-dictionary'

describe('matchDictionary', () => {
  it('returns empty for queries under 2 chars', () => {
    expect(matchDictionary('', 'en')).toEqual([])
    expect(matchDictionary('a', 'en')).toEqual([])
    expect(matchDictionary(' ', 'en')).toEqual([])
  })

  it('matches English labels by prefix', () => {
    const results = matchDictionary('add', 'en')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].entry.key).toBe('address')
    expect(results[0].displayLabel).toBe('Address')
  })

  it('matches Dutch labels by prefix when locale is nl', () => {
    const results = matchDictionary('adr', 'nl')
    expect(results[0].entry.key).toBe('address')
    expect(results[0].displayLabel).toBe('Adres')
  })

  it('matches across locales regardless of current locale', () => {
    // Dutch user typing English word still finds the entry.
    const results = matchDictionary('addr', 'nl')
    expect(results.some((s) => s.entry.key === 'address')).toBe(true)
  })

  it('matches by alias', () => {
    const results = matchDictionary('nls', 'en')
    expect(results[0].entry.key).toBe('nl-sfb-classification')
  })

  it('ranks prefix matches above substring matches', () => {
    // "ad" is a prefix of "Address" (score 3) but only a substring of e.g. "Adres" —
    // but the Dutch label also starts with "ad" (prefix). Pick a query where only
    // prefix/substring distinction is clear: "ea" is substring of "Area", not prefix.
    const results = matchDictionary('ea', 'en')
    if (results.length > 0) {
      // First result should have score 3 if any prefix match exists, or 1 if all substring
      const first = results[0]
      const rest = results.slice(1)
      for (const r of rest) {
        expect(r.score).toBeLessThanOrEqual(first.score)
      }
    }
  })

  it('breaks ties by shorter label first', () => {
    // Both "City" and "Classification"-like entries might match "c", but 2-char min
    // means we use a longer query. Use "co" — matches Color, Country, Coordinates.
    const results = matchDictionary('co', 'en')
    const prefixMatches = results.filter((r) => r.score === 3)
    if (prefixMatches.length >= 2) {
      for (let i = 1; i < prefixMatches.length; i++) {
        expect(prefixMatches[i].displayLabel.length).toBeGreaterThanOrEqual(
          prefixMatches[i - 1].displayLabel.length
        )
      }
    }
  })

  it('respects the limit parameter', () => {
    const results = matchDictionary('e', 'en', 3) // under 2-char min, still empty
    expect(results).toEqual([])
    const results2 = matchDictionary('co', 'en', 2)
    expect(results2.length).toBeLessThanOrEqual(2)
  })

  it('normalizes case and whitespace', () => {
    const a = matchDictionary('  ADDRESS  ', 'en')
    const b = matchDictionary('address', 'en')
    expect(a[0].entry.key).toBe(b[0].entry.key)
  })
})

describe('resolvePropertyLabel', () => {
  it('returns localized label for dictionary keys', () => {
    expect(resolvePropertyLabel('address', 'custom', 'en')).toBe('Address')
    expect(resolvePropertyLabel('address', 'custom', 'nl')).toBe('Adres')
  })

  it('falls back to stored label when key is not in dictionary', () => {
    expect(resolvePropertyLabel('custom-key', 'My Label', 'en')).toBe(
      'My Label'
    )
  })

  it('falls back to key when no label and key is not in dictionary', () => {
    expect(resolvePropertyLabel('custom-key', undefined, 'en')).toBe(
      'custom-key'
    )
  })

  it('returns empty string when both key and label are missing', () => {
    expect(resolvePropertyLabel(undefined, undefined, 'en')).toBe('')
  })
})

describe('getDictionaryEntry', () => {
  it('returns entry for known key', () => {
    const entry = getDictionaryEntry('address')
    expect(entry?.labels.en).toBe('Address')
  })

  it('returns undefined for unknown key', () => {
    expect(getDictionaryEntry('not-a-key')).toBeUndefined()
    expect(getDictionaryEntry(undefined)).toBeUndefined()
    expect(getDictionaryEntry('')).toBeUndefined()
  })
})

describe('getValuePlaceholder', () => {
  it('returns the en hint for a hinted key', () => {
    expect(getValuePlaceholder('email', 'en')).toBe('name@example.com')
  })

  it('returns the nl hint for the same key', () => {
    expect(getValuePlaceholder('email', 'nl')).toBe('naam@voorbeeld.nl')
  })

  it('returns undefined for known keys without a hint configured', () => {
    // `material` is intentionally free-text — no placeholder configured.
    expect(getValuePlaceholder('material', 'en')).toBeUndefined()
  })

  it('returns undefined for null/undefined/empty keys', () => {
    expect(getValuePlaceholder(undefined, 'en')).toBeUndefined()
    expect(getValuePlaceholder(null, 'en')).toBeUndefined()
    expect(getValuePlaceholder('', 'en')).toBeUndefined()
  })

  it('returns undefined for unknown keys', () => {
    expect(getValuePlaceholder('not-a-real-key', 'en')).toBeUndefined()
  })
})
