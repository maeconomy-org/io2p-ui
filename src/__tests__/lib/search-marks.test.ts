import { describe, expect, it } from 'vitest'

import { searchMarks } from '@/lib/search-marks'
import { foldText } from '@/lib/search-text'

const marked = (text: string, q: string) =>
  searchMarks(text, q).map(([start, end]) => text.slice(start, end))

const graphemes = (text: string) =>
  [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
  ].map((part) => part.segment)

describe('searchMarks', () => {
  it.each([
    ['an accent the user did not type', 'Ideeën plein', 'ideeen', ['Ideeën']],
    ['case and an accent', 'Café Noir', 'CAFE', ['Café']],
    ['a decomposed accent in the name', 'Café', 'cafe', ['Café']],
    [
      'each word, in any order',
      'vloer van beton',
      'beton vloer',
      ['vloer', 'beton'],
    ],
    ['a dot, literally', 'rod 1.5 m', '1.5', ['1.5']],
    ['brackets, literally', 'pipe (a) long', '(a)', ['(a)']],
    [
      'every place a word appears',
      'beton en beton',
      'beton',
      ['beton', 'beton'],
    ],
  ])('marks %s', (_, text, q, expected) => {
    expect(marked(text, q)).toEqual(expected)
  })

  it('merges words that overlap into one mark', () => {
    expect(marked('betonvloer', 'beton tonv')).toEqual(['betonv'])
  })

  it('merges words that touch into one mark', () => {
    expect(marked('betonvloer', 'beton vloer')).toEqual(['betonvloer'])
  })

  it.each([
    ['no q', undefined],
    ['an empty q', ''],
    ['one letter', 'b'],
  ])('marks nothing for %s', (_, q) => {
    expect(searchMarks('beton', q)).toEqual([])
  })

  it('marks only the words of 2 or more characters', () => {
    expect(marked('a beton b', 'a beton')).toEqual(['beton'])
  })

  it('does not join two words across a space', () => {
    expect(marked('van beton', 'vanbeton')).toEqual([])
  })

  it.each([
    ['a keycap', '1️⃣2 rod', '12', '1️⃣2'],
    ['a heart', 'big ❤️box', '❤box', '❤️box'],
    ['a family emoji', 'x 👨‍👩‍👧 yard', 'yard', 'yard'],
  ])('never cuts %s', (_, text, q, expected) => {
    expect(marked(text, q)).toEqual([expected])
  })

  it('handles a long name', () => {
    const text = 'x'.repeat(9000) + ' beton'
    expect(marked(text, 'beton')).toEqual(['beton'])
  })

  // The marks fold one grapheme at a time; this holds only while that equals the whole-name fold.
  it.each([
    ['interior spaces', 'vloer van beton'],
    ['spaces at both ends', '  beton  '],
    ['a decomposed accent', 'Ideën'],
    ['a dotted capital I', 'İstanbul'],
    ['a final sigma', 'ΟΔΟΣ'],
    ['decomposed Hangul', '한글'],
    ['a heart', 'a ❤️ b'],
    ['a keycap', '1️⃣ rod'],
    ['a family emoji', 'x 👨‍👩‍👧 y'],
    ['a sharp s', 'Straße ẞ'],
  ])('folds %s the same in parts as whole', (_, text) => {
    expect(graphemes(text).map(foldText).join('')).toBe(foldText(text))
  })
})
