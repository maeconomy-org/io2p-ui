import { describe, it, expect } from 'vitest'

import {
  PROPERTY_DICTIONARY,
  matchDictionary,
  resolvePropertyLabel,
  getDictionaryEntry,
  getValuePlaceholder,
  resolveKey,
  findExactTerm,
  slug,
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

describe('near-miss suggestions', () => {
  // The qualified name is the everyday case — someone writes "Gewicht (kg)" or "total weight" and
  // means the term plus a note. Scoring the query only against the term found nothing for exactly
  // those, so the longer the user typed the less help they got.
  it('suggests the term a qualified name is built on', () => {
    expect(matchDictionary('Gewicht (kg)', 'nl')[0]?.entry.key).toBe('weight')
    expect(matchDictionary('total weight', 'en')[0]?.entry.key).toBe('weight')
  })

  it('still ranks the exact term first', () => {
    expect(matchDictionary('Weight', 'en')[0]?.entry.key).toBe('weight')
  })

  // Suggesting is not resolving: an unchosen suggestion leaves the typed text as its own key.
  it('does not silently adopt the suggested key', () => {
    expect(resolveKey('Gewicht (kg)').key).toBe('gewicht-kg')
  })
})

describe('slug', () => {
  it('produces one key for one word however it was typed', () => {
    expect(slug('  Vloer Oppervlak  ')).toBe('vloer-oppervlak')
    expect(slug('vloer oppervlak')).toBe('vloer-oppervlak')
  })

  // The node lowercases a key and nothing else, so an accent that survives here becomes a second
  // key for the same word — and a rollup rule matching exactly would sum only one of them.
  it('strips diacritics rather than preserving them', () => {
    expect(slug('Oppervlákte')).toBe(slug('Oppervlakte'))
    expect(slug('CO₂-uitstoot')).toBe('co-uitstoot')
  })

  it('drops punctuation and never leaves a leading or trailing dash', () => {
    expect(slug('Weight (kg)')).toBe('weight-kg')
    expect(slug('---weight---')).toBe('weight')
    expect(slug('   ')).toBe('')
  })
})

describe('findExactTerm', () => {
  it('matches a key, a label in either locale, and an alias', () => {
    expect(findExactTerm('weight')?.key).toBe('weight')
    expect(findExactTerm('Weight')?.key).toBe('weight')
    expect(findExactTerm('Gewicht')?.key).toBe('weight')
  })

  it('ignores case and surrounding space', () => {
    expect(findExactTerm('  GEWICHT ')?.key).toBe('weight')
  })

  // `cost` is both a key and an alias of `price`; without a precedence rule, which one wins
  // depends on array position, so typing a term's exact name could resolve to a different term.
  it('prefers a term own key over another term alias', () => {
    expect(findExactTerm('cost')?.key).toBe('cost')
    expect(findExactTerm('state')?.key).toBe('state')
    expect(findExactTerm('location')?.key).toBe('location')
  })

  it('still resolves an alias that no key claims', () => {
    expect(findExactTerm('type')?.key).toBe('category')
  })

  // A near-miss is for the suggestion list, not for silent resolution.
  it('does not match a partial term', () => {
    expect(findExactTerm('Gewicht (kg)')).toBeUndefined()
    expect(findExactTerm('weigh')).toBeUndefined()
  })
})

describe('resolveKey', () => {
  it('lands a term typed in either language on one shared key', () => {
    expect(resolveKey('Gewicht').key).toBe('weight')
    expect(resolveKey('Weight').key).toBe('weight')
  })

  it('keeps the text the user typed as the label', () => {
    expect(resolveKey('Gewicht')).toEqual({ key: 'weight', label: 'Gewicht' })
  })

  it('slugs a term the dictionary does not know', () => {
    expect(resolveKey('Vloerafwerking type B')).toEqual({
      key: 'vloerafwerking-type-b',
      label: 'Vloerafwerking type B',
    })
  })

  // The residual the dictionary exists to shrink: nothing can know these are one concept.
  it('cannot bridge languages for an unknown term', () => {
    expect(resolveKey('Vloerafwerking').key).not.toBe(
      resolveKey('Floor finish').key
    )
  })
})

describe('the dictionary itself', () => {
  // A duplicate key silently shadows an entry; an alias owned by two entries resolves to whichever
  // is declared first. Both are invisible in review and neither can be seen from the UI.
  it('declares every key exactly once', () => {
    const keys = PROPERTY_DICTIONARY.map((e) => e.key)
    expect(keys).toHaveLength(new Set(keys).size)
  })

  it('never lets two entries claim one alias', () => {
    const owners = new Map<string, string[]>()
    for (const entry of PROPERTY_DICTIONARY) {
      for (const alias of [
        ...(entry.aliases?.en ?? []),
        ...(entry.aliases?.nl ?? []),
      ]) {
        owners.set(alias, [...(owners.get(alias) ?? []), entry.key])
      }
    }
    const shared = [...owners.entries()].filter(
      ([, keys]) => new Set(keys).size > 1
    )
    expect(shared).toEqual([])
  })

  it('keeps every key in the form slug() produces', () => {
    for (const entry of PROPERTY_DICTIONARY) {
      expect(entry.key).toBe(slug(entry.key))
    }
  })
})
