import { describe, it, expect } from 'vitest'

import { ALPHA3_TO_ALPHA2, countryLabel } from '@/constants/country-codes'

describe('ALPHA3_TO_ALPHA2', () => {
  it('maps the countries this product actually touches', () => {
    // Spelled out rather than spot-checked by count: a transcription slip in a 249-entry table is
    // silent, and stores the wrong country for exactly one place forever.
    expect({
      NLD: ALPHA3_TO_ALPHA2.NLD,
      BEL: ALPHA3_TO_ALPHA2.BEL,
      DEU: ALPHA3_TO_ALPHA2.DEU,
      FRA: ALPHA3_TO_ALPHA2.FRA,
      GBR: ALPHA3_TO_ALPHA2.GBR,
      CHE: ALPHA3_TO_ALPHA2.CHE,
      AUT: ALPHA3_TO_ALPHA2.AUT,
      LUX: ALPHA3_TO_ALPHA2.LUX,
      DNK: ALPHA3_TO_ALPHA2.DNK,
      ESP: ALPHA3_TO_ALPHA2.ESP,
      USA: ALPHA3_TO_ALPHA2.USA,
    }).toEqual({
      NLD: 'NL',
      BEL: 'BE',
      DEU: 'DE',
      FRA: 'FR',
      GBR: 'GB',
      CHE: 'CH',
      AUT: 'AT',
      LUX: 'LU',
      DNK: 'DK',
      ESP: 'ES',
      USA: 'US',
    })
  })

  it('holds only well-formed, unique codes', () => {
    const entries = Object.entries(ALPHA3_TO_ALPHA2)
    expect(entries.length).toBeGreaterThan(240)
    expect(entries.every(([a3]) => /^[A-Z]{3}$/.test(a3))).toBe(true)
    expect(entries.every(([, a2]) => /^[A-Z]{2}$/.test(a2))).toBe(true)
    // Two alpha-3s collapsing onto one alpha-2 would silently merge two countries.
    expect(new Set(entries.map(([, a2]) => a2)).size).toBe(entries.length)
  })

  it('produces only codes the platform itself recognises', () => {
    const display = new Intl.DisplayNames(['en'], { type: 'region' })
    const unrecognised = Object.values(ALPHA3_TO_ALPHA2).filter((code) => {
      const name = display.of(code)
      return !name || name === code
    })

    expect(unrecognised).toEqual([])
  })
})

describe('countryLabel', () => {
  it('renders a stored code in the reader’s own language', () => {
    // The point of storing a code: the same row reads correctly for every user.
    expect(countryLabel('NL', 'en')).toBe('Netherlands')
    expect(countryLabel('NL', 'nl')).toBe('Nederland')
  })

  it('passes a legacy display name through unchanged', () => {
    // Rows written before this change hold "Nederland" in the country field. Showing them blank
    // would look like data loss; they are simply not codes yet.
    expect(countryLabel('Nederland', 'en')).toBe('Nederland')
  })

  it('returns undefined for an empty country, so the row is omitted', () => {
    expect(countryLabel(undefined, 'en')).toBeUndefined()
    expect(countryLabel('', 'en')).toBeUndefined()
  })

  it('shows an unassigned code rather than swallowing it', () => {
    // `QQ` is well-formed but unassigned. Note `ZZ` would NOT do here — CLDR assigns it as the
    // literal "Unknown Region", so it is a named code, not a missing one.
    expect(countryLabel('QQ', 'en')).toBe('QQ')
  })
})
