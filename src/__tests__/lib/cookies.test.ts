import { describe, it, expect, afterEach, vi } from 'vitest'

import {
  COOKIE_DEFAULTS,
  deleteCookie,
  parseCookieHeader,
  readCookie,
  serializeCookie,
  writeCookie,
} from '@/lib/cookies'

// jsdom refuses a redefine of `location.protocol`, so swap the whole object.
function setProtocol(protocol: 'http:' | 'https:') {
  vi.stubGlobal('location', { ...window.location, protocol })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('cookies', () => {
  describe('parseCookieHeader', () => {
    it('returns an empty jar for a missing or empty header', () => {
      expect(parseCookieHeader(undefined)).toEqual({})
      expect(parseCookieHeader(null)).toEqual({})
      expect(parseCookieHeader('')).toEqual({})
    })

    it('parses pairs and tolerates the space after a semicolon', () => {
      expect(parseCookieHeader('a=1; b=2')).toEqual({ a: '1', b: '2' })
    })

    it('splits on the FIRST equals so a packed value survives', () => {
      expect(parseCookieHeader('token=abc=def==')).toEqual({
        token: 'abc=def==',
      })
    })

    it('skips a segment with no name', () => {
      expect(parseCookieHeader('=orphan; a=1')).toEqual({ a: '1' })
    })
  })

  describe('serializeCookie', () => {
    it('emits the defaults', () => {
      const out = serializeCookie('k', 'v')
      expect(out).toContain('k=v')
      expect(out).toContain(`Path=${COOKIE_DEFAULTS.path}`)
      expect(out).toContain(`Max-Age=${COOKIE_DEFAULTS.maxAge}`)
      expect(out).toContain('SameSite=Lax')
    })

    // The regression that would make every preference look unwritable in dev.
    it('omits Secure on http and adds it on https', () => {
      setProtocol('http:')
      expect(serializeCookie('k', 'v')).not.toContain('Secure')
      setProtocol('https:')
      expect(serializeCookie('k', 'v')).toContain('Secure')
    })

    it('honours an overridden maxAge', () => {
      expect(serializeCookie('k', 'v', { maxAge: 0 })).toContain('Max-Age=0')
    })
  })

  describe('read / write / delete', () => {
    it('round-trips through document.cookie', () => {
      writeCookie('pref', 'abc')
      expect(readCookie('pref')).toBe('abc')
    })

    it('returns undefined for a cookie that is not set', () => {
      expect(readCookie('absent-cookie')).toBeUndefined()
    })

    it('expires the cookie on delete', () => {
      const setter = vi.fn()
      vi.spyOn(document, 'cookie', 'set').mockImplementation(setter)
      deleteCookie('pref')
      expect(setter).toHaveBeenCalledWith(expect.stringContaining('Max-Age=0'))
    })
  })
})
