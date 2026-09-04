import { describe, it, expect } from 'vitest'
import { cn, formatBytes, truncateText } from '@/lib/utils'

const isFalse = false

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', isFalse && 'bar', 'baz')).toBe('foo baz')
    })

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('should handle arrays of classes', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
    })
  })

  describe('formatBytes', () => {
    // `null` rather than "0 B" is the contract: callers render the label only when there is a
    // size to show, so a missing size must be distinguishable from a real zero-length file.
    it('returns null when there is no usable size', () => {
      expect(formatBytes(undefined)).toBeNull()
      expect(formatBytes(0)).toBeNull()
      expect(formatBytes(-1)).toBeNull()
      expect(formatBytes(NaN)).toBeNull()
      expect(formatBytes(Infinity)).toBeNull()
    })

    it('picks the unit from the magnitude', () => {
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(2048)).toBe('2.0 KB')
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
      expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
    })

    it('switches unit exactly at the boundary, not before', () => {
      expect(formatBytes(1023)).toBe('1023 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    })
  })

  describe('truncateText', () => {
    it('leaves text at or under the limit untouched', () => {
      expect(truncateText('short', 10)).toBe('short')
      expect(truncateText('exactly10!', 10)).toBe('exactly10!')
    })

    it('truncates from the end by default', () => {
      expect(truncateText('abcdefghij', 4)).toBe('abcd...')
    })

    it('truncates from the middle when asked, keeping both ends', () => {
      expect(truncateText('abcdefghij', 4, true)).toBe('ab...ij')
    })

    it('handles empty input', () => {
      expect(truncateText('', 10)).toBe('')
    })
  })
})
