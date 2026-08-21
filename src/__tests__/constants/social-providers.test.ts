import { describe, it, expect } from 'vitest'

import {
  SOCIAL_PROVIDERS,
  describeCredential,
  enabledSocialProviders,
} from '@/constants/auth'
import { DEFAULT_CLIENT_CONFIG } from '@/constants/client'

const ids = (configured: string) =>
  enabledSocialProviders(configured).map((p) => p.id)

describe('enabledSocialProviders', () => {
  it('returns the providers named in the config', () => {
    expect(ids('google,microsoft')).toEqual(['google', 'microsoft'])
    expect(ids('google')).toEqual(['google'])
  })

  // An empty value is a deployer turning social sign-in OFF, not an unset one falling back to
  // the default — the button would 400 at the issuer.
  it('returns nothing for an empty or whitespace value', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
    expect(ids(',,')).toEqual([])
  })

  it('tolerates padding and casing from a hand-edited env file', () => {
    expect(ids(' Google , MICROSOFT ')).toEqual(['google', 'microsoft'])
  })

  it('drops ids this build has no mark or label for', () => {
    expect(ids('google,github')).toEqual(['google'])
    expect(ids('github')).toEqual([])
  })

  // The buttons stack in one column, so config order must not reshuffle them between deploys.
  it('keeps registry order regardless of config order', () => {
    expect(ids('microsoft,google')).toEqual(['google', 'microsoft'])
  })

  it('enables every registered provider by default', () => {
    expect(ids(DEFAULT_CLIENT_CONFIG.socialProviders)).toEqual(
      SOCIAL_PROVIDERS.map((p) => p.id)
    )
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
