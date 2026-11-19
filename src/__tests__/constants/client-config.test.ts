import { describe, it, expect, afterEach, vi } from 'vitest'

import { buildRuntimeConfig } from '@/constants/client'

afterEach(() => vi.unstubAllEnvs())

describe('buildRuntimeConfig — mtlsBaseUrl', () => {
  it('maps MTLS_AUTH_URL to mtlsBaseUrl', () => {
    vi.stubEnv('MTLS_AUTH_URL', 'https://mtls-auth.example.com')
    expect(buildRuntimeConfig().mtlsBaseUrl).toBe(
      'https://mtls-auth.example.com'
    )
  })

  it('is undefined when MTLS_AUTH_URL is unset or empty', () => {
    vi.stubEnv('MTLS_AUTH_URL', '')
    expect(buildRuntimeConfig().mtlsBaseUrl).toBeUndefined()
  })

  it('never borrows AUTH_BASE_URL', () => {
    vi.stubEnv('MTLS_AUTH_URL', '')
    vi.stubEnv('AUTH_BASE_URL', 'https://auth.example.com')
    expect(buildRuntimeConfig().mtlsBaseUrl).toBeUndefined()
  })
})
