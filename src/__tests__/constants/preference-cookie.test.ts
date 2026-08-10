import { describe, it, expect } from 'vitest'

import {
  decodePreferenceCookie,
  encodePreferenceCookie,
  packHintsFromPreferences,
} from '@/constants/preference-cookie'

const FULL = {
  objectsView: 'columns',
  processView: 'network',
  pageSize: 50,
  theme: 'dark',
  locale: 'nl',
} as const

describe('preference-cookie', () => {
  describe('encode / decode', () => {
    it('round-trips every mirrored value', () => {
      expect(decodePreferenceCookie(encodePreferenceCookie(FULL))).toEqual(FULL)
    })

    it('stays small enough to ride every request', () => {
      expect(encodePreferenceCookie(FULL).length).toBeLessThan(40)
    })

    it('treats an empty segment as no opinion', () => {
      const encoded = encodePreferenceCookie({ theme: 'dark' })
      expect(decodePreferenceCookie(encoded)).toEqual({ theme: 'dark' })
    })

    it('decodes nothing from an absent or empty cookie', () => {
      expect(decodePreferenceCookie(undefined)).toEqual({})
      expect(decodePreferenceCookie('')).toEqual({})
    })

    it('decodes nothing from an unknown version', () => {
      expect(decodePreferenceCookie('9.c.n.50.d.nl')).toEqual({})
    })

    // Forward compatibility: a newer client appends, an older one ignores.
    it('reads the known fields out of a longer value', () => {
      expect(decodePreferenceCookie('1.c.n.50.d.nl.future')).toEqual(FULL)
    })
  })

  describe('validation through the registry', () => {
    it('drops a retired view code rather than selecting it', () => {
      expect(
        decodePreferenceCookie('1.z.t.20.d.en').objectsView
      ).toBeUndefined()
    })

    it('drops a page size that is not an offered option', () => {
      expect(decodePreferenceCookie('1.t.t.999.d.en').pageSize).toBeUndefined()
    })

    it('drops an unsupported locale', () => {
      expect(decodePreferenceCookie('1.t.t.20.d.de').locale).toBeUndefined()
    })

    it('keeps the valid fields when a neighbour is dropped', () => {
      expect(decodePreferenceCookie('1.t.t.999.d.en')).toEqual({
        objectsView: 'table',
        processView: 'table',
        theme: 'dark',
        locale: 'en',
      })
    })
  })

  describe('packHintsFromPreferences', () => {
    it('reads locale through its `app` storage key, not its registry key', () => {
      expect(packHintsFromPreferences({ locale: { app: 'nl' } })).toEqual({
        locale: 'nl',
      })
      expect(packHintsFromPreferences({ locale: { locale: 'nl' } })).toEqual({})
    })

    it('projects the bag down to the mirrored subset only', () => {
      const packed = packHintsFromPreferences({
        ui: { objectsView: 'columns', theme: 'dark', filesView: 'grid' },
        defaults: { pageSize: 50 },
        onboarding: { toursSeen: ['initial-login'] },
      })
      expect(packed).toEqual({
        objectsView: 'columns',
        theme: 'dark',
        pageSize: 50,
      })
    })

    it('returns nothing for an undefined bag', () => {
      expect(packHintsFromPreferences(undefined)).toEqual({})
    })
  })
})
