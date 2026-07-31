import { describe, it, expect } from 'vitest'

import {
  ENERGY_LABEL_PALETTE,
  getEnergyLabelClasses,
  getStatusBadgeClasses,
  isUrlValue,
  resolveColorSwatch,
  urlLinkLabel,
} from '@/components/passport/utils/passport-formatters'

describe('passport-formatters', () => {
  describe('isUrlValue', () => {
    it('treats *-url dictionary keys as URLs even with bare values', () => {
      expect(isUrlValue('datasheet-url', 'docs.example.com/x.pdf')).toBe(true)
      expect(isUrlValue('epd-url', 'https://x.com')).toBe(true)
    })

    it('treats the website key as a URL', () => {
      expect(isUrlValue('website', 'reynaers.com')).toBe(true)
    })

    it('detects http(s) values for unknown keys', () => {
      expect(isUrlValue('notes', 'https://example.com')).toBe(true)
      expect(isUrlValue('notes', '  http://example.com  ')).toBe(true)
    })

    it('returns false for plain text on non-URL keys', () => {
      expect(isUrlValue('notes', 'Inspect annually')).toBe(false)
      expect(isUrlValue(undefined, 'plain string')).toBe(false)
    })
  })

  describe('urlLinkLabel', () => {
    it('strips protocol, www, and trailing slash', () => {
      expect(urlLinkLabel('https://www.example.com/')).toBe('example.com')
      expect(urlLinkLabel('http://example.com/path/')).toBe('example.com/path')
    })

    it('returns the original value when nothing was strippable', () => {
      expect(urlLinkLabel('reynaers.com')).toBe('reynaers.com')
    })

    it('falls back to the raw value if cleaning yields empty', () => {
      // Edge case: cleaning a bare protocol leaves empty string — must not
      // render an empty <a> with no visible text.
      expect(urlLinkLabel('https://')).toBe('https://')
    })
  })

  describe('getStatusBadgeClasses', () => {
    it('classifies operational/active values as emerald', () => {
      expect(getStatusBadgeClasses('Operational')).toContain('emerald')
      expect(getStatusBadgeClasses('In Use')).toContain('emerald')
      expect(getStatusBadgeClasses('Active')).toContain('emerald')
    })

    it('classifies decommissioned values as zinc', () => {
      expect(getStatusBadgeClasses('Decommissioned')).toContain('zinc')
      expect(getStatusBadgeClasses('archived')).toContain('zinc')
    })

    it('classifies maintenance/pending values as amber', () => {
      expect(getStatusBadgeClasses('Scheduled maintenance')).toContain('amber')
      expect(getStatusBadgeClasses('pending')).toContain('amber')
    })

    it('classifies error/critical values as red', () => {
      expect(getStatusBadgeClasses('Critical fault')).toContain('red')
    })

    it('falls back to blue for unknown values', () => {
      expect(getStatusBadgeClasses('Whatever')).toContain('blue')
    })
  })

  describe('getEnergyLabelClasses', () => {
    it('returns a palette entry for known grades, case-insensitively', () => {
      expect(getEnergyLabelClasses('a+')).toBe(ENERGY_LABEL_PALETTE['A+'])
      expect(getEnergyLabelClasses(' G ')).toBe(ENERGY_LABEL_PALETTE['G'])
    })

    it('returns null for unknown grades', () => {
      expect(getEnergyLabelClasses('Z')).toBeNull()
      expect(getEnergyLabelClasses('')).toBeNull()
    })
  })

  describe('resolveColorSwatch', () => {
    it('passes through hex values', () => {
      expect(resolveColorSwatch('#ff0000')).toBe('#ff0000')
      expect(resolveColorSwatch('#FFF')).toBe('#fff')
    })

    it('matches named colors anywhere in the value', () => {
      // "White (RAL 9010)" should still resolve to a white swatch.
      expect(resolveColorSwatch('White (RAL 9010)')).toBe('#ffffff')
      expect(resolveColorSwatch('Bronze finish')).toBe('#a97142')
    })

    it('returns null when no hint matches', () => {
      expect(resolveColorSwatch('Mauve plasma')).toBeNull()
    })
  })
})
