import { describe, expect, it } from 'vitest'

import { MAX_SEARCH_CHARS } from '@/constants'
import { searchText } from '@/lib/search-text'

describe('searchText', () => {
  it.each([
    ['ab', 'ab'],
    ['  beton  ', 'beton'],
    ['Blok A', 'Blok A'],
  ])('%j → %j', (raw, expected) => {
    expect(searchText(raw)).toBe(expected)
  })

  it.each([[''], ['a'], ['  a  '], ['   '], [undefined]])(
    '%j is too short to search',
    (raw) => {
      expect(searchText(raw)).toBeUndefined()
    }
  )

  it('counts code points, not UTF-16 units', () => {
    expect(searchText('😀')).toBeUndefined()
    expect(searchText('😀😀')).toBe('😀😀')
  })

  it('counts a decomposed accent as one character, as the node does', () => {
    expect(searchText('é')).toBeUndefined()
  })
  it('caps a long paste under the node limit', () => {
    expect(searchText('a'.repeat(5000))).toHaveLength(MAX_SEARCH_CHARS)
  })

  it('never splits an emoji at the cap', () => {
    const result = searchText('a' + '😀'.repeat(1000))!
    expect(result.length).toBeLessThanOrEqual(MAX_SEARCH_CHARS)
    expect(result.endsWith('😀')).toBe(true)
  })
})
