import { describe, it, expect } from 'vitest'
import {
  cn,
  formatFingerprint,
  formatUUID,
  toCapitalize,
  isObjectDeleted,
} from '@/lib/utils'

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

  describe('formatFingerprint', () => {
    it('should return empty string for empty input', () => {
      expect(formatFingerprint('')).toBe('')
    })

    it('should return full fingerprint if 24 chars or less', () => {
      expect(formatFingerprint('abc123')).toBe('abc123')
      expect(formatFingerprint('a'.repeat(24))).toBe('a'.repeat(24))
    })

    it('should truncate fingerprint longer than 24 chars', () => {
      const longFingerprint = 'a'.repeat(30)
      expect(formatFingerprint(longFingerprint)).toBe('a'.repeat(24) + '...')
    })
  })

  describe('formatUUID', () => {
    it('should return full UUID if 12 chars or less', () => {
      expect(formatUUID('abc123')).toBe('abc123')
      expect(formatUUID('a'.repeat(12))).toBe('a'.repeat(12))
    })

    it('should truncate UUID longer than 12 chars with ellipsis', () => {
      const uuid = '123456789012345678901234'
      expect(formatUUID(uuid)).toBe('123456789012...345678901234')
    })

    it('should show first 12 and last 12 chars for long UUIDs', () => {
      const uuid = 'abcdefghijklmnopqrstuvwxyz'
      const result = formatUUID(uuid)
      expect(result).toBe('abcdefghijkl...opqrstuvwxyz')
    })
  })

  describe('toCapitalize', () => {
    it('should capitalize first letter', () => {
      expect(toCapitalize('hello')).toBe('Hello')
    })

    it('should handle already capitalized strings', () => {
      expect(toCapitalize('Hello')).toBe('Hello')
    })

    it('should handle single character', () => {
      expect(toCapitalize('a')).toBe('A')
    })

    it('should handle empty string', () => {
      expect(toCapitalize('')).toBe('')
    })

    it('should only capitalize first letter, not others', () => {
      expect(toCapitalize('hELLO')).toBe('HELLO')
    })
  })

  describe('isObjectDeleted', () => {
    it('should return true for softDeleted objects', () => {
      expect(isObjectDeleted({ softDeleted: true })).toBe(true)
    })

    it('should return false for non-deleted objects', () => {
      expect(isObjectDeleted({ softDeleted: false })).toBe(false)
    })

    it('should return false for objects without softDeleted property', () => {
      expect(isObjectDeleted({})).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isObjectDeleted(null)).toBe(false)
      expect(isObjectDeleted(undefined)).toBe(false)
    })
  })
})
