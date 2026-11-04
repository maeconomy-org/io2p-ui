import { describe, expect, it } from 'vitest'

import { MAX_DESCRIPTION_CHARS } from '@/constants'
import { descriptionTooLong } from '@/lib/entity'

const atLimit = 'a'.repeat(MAX_DESCRIPTION_CHARS)
const over = atLimit + 'a'

describe('descriptionTooLong', () => {
  it('refuses a sent description over the limit', () => {
    expect(descriptionTooLong(over, true)).toBe(true)
  })

  it('accepts one exactly at the limit', () => {
    expect(descriptionTooLong(atLimit, true)).toBe(false)
  })

  it('accepts an old long description that is not sent', () => {
    expect(descriptionTooLong(over, false)).toBe(false)
  })

  it('counts an emoji as one character', () => {
    const emojis = '😀'.repeat(MAX_DESCRIPTION_CHARS)
    expect(emojis.length).toBeGreaterThan(MAX_DESCRIPTION_CHARS)
    expect(descriptionTooLong(emojis, true)).toBe(false)
  })

  it('accepts no description', () => {
    expect(descriptionTooLong(null, true)).toBe(false)
    expect(descriptionTooLong(undefined, true)).toBe(false)
  })
})
