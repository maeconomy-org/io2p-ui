import { describe, it, expect } from 'vitest'

import {
  SOCIAL_PROVIDERS,
  describeCredential,
  enabledSocialProviders,
} from '@/constants/auth'
const ids = (enabled: string[]) =>
  enabledSocialProviders(enabled).map((p) => p.id)

describe('enabledSocialProviders', () => {
  it('returns the providers the issuer reports', () => {
    expect(ids(['google', 'microsoft'])).toEqual(['google', 'microsoft'])
    expect(ids(['google'])).toEqual(['google'])
  })

  it('returns nothing when the issuer reports nothing', () => {
    expect(ids([])).toEqual([])
  })

  it('drops ids this build has no mark or label for', () => {
    expect(ids(['google', 'github'])).toEqual(['google'])
    expect(ids(['github'])).toEqual([])
  })

  // The buttons stack in one column, so issuer order must not reshuffle them between deploys.
  it('keeps registry order regardless of issuer order', () => {
    expect(ids(['microsoft', 'google'])).toEqual(['google', 'microsoft'])
  })
})

describe('describeCredential', () => {
  it('brands a social provider with its own mark', () => {
    const google = describeCredential('google')
    expect(google.branded).toBe(true)
    expect(google.labelKey).toBe('google')
    expect(describeCredential('microsoft').Icon).toBe(
      SOCIAL_PROVIDERS.find((p) => p.id === 'microsoft')?.Icon
    )
  })

  it('labels a password account, unbranded', () => {
    const password = describeCredential('credential')
    expect(password.branded).toBe(false)
    expect(password.labelKey).toBe('credential')
  })

  // A provider enabled at the issuer but unknown to this build must still get a
  // row: a credential the user cannot see is one they cannot reason about.
  it('falls back to a generic label rather than dropping the row', () => {
    const unknown = describeCredential('gitlab')
    expect(unknown.branded).toBe(false)
    expect(unknown.labelKey).toBe('unknown')
    expect(unknown.Icon).toBeTruthy()
  })
})
