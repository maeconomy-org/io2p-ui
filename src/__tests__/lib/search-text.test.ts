import { describe, expect, it } from 'vitest'

import {
  MAX_SEARCH_CHARS,
  MAX_SEARCH_WORDS,
  MIN_SEARCH_CHARS,
} from '@/constants'
import {
  foldSearch,
  nextSearch,
  searchInput,
  searchWords,
} from '@/lib/search-text'

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

// The cases of io2p-core `textFold` (src/lib/engine/__tests__/index-writer.test.ts) and its
// limits `MIN_Q` / `MAX_Q_WORDS` (src/lib/http/index-query.ts). Change them together.
describe('foldSearch is the node fold', () => {
  it.each([
    ['a diaeresis', 'Ideeën', 'ideeen'],
    ['acute accents', 'één', 'een'],
    ['case and an accent', 'CAFÉ', 'cafe'],
    ['a decomposed accent', 'Café', 'cafe'],
    ['a dotted capital I', 'İ', 'i'],
    ['a capital sigma at a word end', 'ΟΔΟΣ', 'οδοσ'],
    ['only combining marks', ' ́̈ ', ''],
    ['a sharp s, never "ss"', 'Straße', 'straße'],
    ['a capital sharp s', 'ẞ', 'ß'],
    ['decomposed Hangul, composed again', '한', '한'],
  ])('folds %s', (_, input, folded) => {
    expect(foldSearch(input)).toBe(folded)
  })

  it.each([
    ['a superscript', 'm²'],
    ['the Dutch ij ligature', 'ĳ'],
    ['Hangul syllables, composed again', '한글'],
    ['the separator', 'a\u0000b'],
  ])('keeps %s', (_, input) => {
    expect(foldSearch(input)).toBe(input)
  })

  it('uses the node limits', () => {
    expect(MIN_SEARCH_CHARS).toBe(2)
    expect(MAX_SEARCH_WORDS).toBe(8)
  })
})

describe('searchWords', () => {
  it('counts a word once, whatever its case or accents', () => {
    expect(searchWords('beton Beton BÉTON')).toEqual(['beton'])
  })

  it('splits on any white space, as the node does', () => {
    expect(searchWords('beton　vloer plaat')).toEqual([
      'beton',
      'vloer',
      'plaat',
    ])
  })
})

describe('searchInput on a word list', () => {
  it.each([
    ['ab', 'ab'],
    ['  beton  ', 'beton'],
    ['Blok A', 'Blok A'],
    ['a bc', 'a bc'],
  ])('%j → q %j', (raw, q) => {
    expect(searchInput(raw, 'words')).toEqual({ status: 'ok', q })
  })

  it.each([[''], ['   '], [undefined]])('%j is empty', (raw) => {
    expect(searchInput(raw, 'words')).toEqual({ status: 'empty' })
  })

  it.each([
    ['one letter', 'a'],
    ['only one-letter words', 'a b c'],
    ['one emoji', '😀'],
    ['an accent that folds away', 'à́'],
    ['a dotted capital I, one letter once folded', 'İ'],
  ])('refuses %s as too short', (_, raw) => {
    expect(searchInput(raw, 'words')).toEqual({
      status: 'refused',
      problem: 'too-short',
    })
  })

  it('takes 8 different words', () => {
    expect(searchInput(words(8), 'words')).toEqual({
      status: 'ok',
      q: words(8),
    })
  })

  it.each([
    ['9 words', words(9)],
    ['9 words split by ideographic spaces', words(9).replaceAll(' ', '　')],
  ])('refuses %s as too many', (_, raw) => {
    expect(searchInput(raw, 'words')).toEqual({
      status: 'refused',
      problem: 'too-many-words',
    })
  })

  it('counts a repeated word once', () => {
    expect(searchInput(`${words(8)} WORD0 wórd1`, 'words').status).toBe('ok')
  })

  it('removes U+0000, which the node refuses', () => {
    expect(searchInput('be\u0000ton', 'words')).toEqual({
      status: 'ok',
      q: 'beton',
    })
  })

  it('caps a long paste under the node limit', () => {
    const input = searchInput('a'.repeat(5000), 'words')
    expect(input.status === 'ok' && input.q).toHaveLength(MAX_SEARCH_CHARS)
  })

  it('never splits an emoji at the cap', () => {
    const input = searchInput('a' + '😀'.repeat(1000), 'words')
    if (input.status !== 'ok') throw new Error(input.status)
    expect(input.q.length).toBeLessThanOrEqual(MAX_SEARCH_CHARS)
    expect(input.q.endsWith('😀')).toBe(true)
  })

  it('counts the words of the text it sends, after the cap', () => {
    const raw = 'x'.repeat(MAX_SEARCH_CHARS - 2) + ' ' + words(9)
    expect(searchInput(raw, 'words').status).toBe('ok')
  })
})

describe('searchInput on a substring list', () => {
  it.each([
    ['only one-letter words', 'a b c'],
    ['9 words', words(9)],
  ])('sends %s', (_, raw) => {
    expect(searchInput(raw, 'substring')).toEqual({ status: 'ok', q: raw })
  })

  it.each([['a'], ['😀'], ['é']])('refuses %j as too short', (raw) => {
    expect(searchInput(raw, 'substring')).toEqual({
      status: 'refused',
      problem: 'too-short',
    })
  })
})

describe('nextSearch', () => {
  it('sends the new q', () => {
    expect(nextSearch({ status: 'ok', q: 'vloer' }, 'beton')).toBe('vloer')
  })

  it('sends no q for an empty field', () => {
    expect(nextSearch({ status: 'empty' }, 'beton')).toBeUndefined()
  })

  it('sends no q for a search too short to run', () => {
    expect(
      nextSearch({ status: 'refused', problem: 'too-short' }, 'beton')
    ).toBeUndefined()
  })

  it('keeps the last q for too many words', () => {
    expect(
      nextSearch({ status: 'refused', problem: 'too-many-words' }, 'beton')
    ).toBe('beton')
  })
})
