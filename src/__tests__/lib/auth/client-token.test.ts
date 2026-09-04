import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    useSession: vi.fn(),
    signIn: {},
    signOut: vi.fn(),
    twoFactor: {},
  }),
}))
vi.mock('better-auth/client/plugins', () => ({ twoFactorClient: () => ({}) }))
vi.mock('@/constants/client', () => ({
  getCachedConfig: () => ({ authBaseUrl: 'http://auth' }),
}))

import { getCoreToken, clearCoreToken } from '@/lib/auth/client'

// A JWT whose payload carries `exp` (seconds). Header/signature are irrelevant to jwtExpMs.
function jwt(expSeconds: number): string {
  return `x.${btoa(JSON.stringify({ exp: expSeconds }))}.y`
}

function mockFetchReturning(token: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('getCoreToken caching', () => {
  beforeEach(() => {
    clearCoreToken()
    vi.restoreAllMocks()
  })

  it('mints once and reuses the cached token within its lifetime', async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 900) // ~15 min out
    const fetchMock = mockFetchReturning(token)

    expect(await getCoreToken()).toBe(token)
    expect(await getCoreToken()).toBe(token)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-mints when force is passed (the 401 retry)', async () => {
    const fetchMock = mockFetchReturning(
      jwt(Math.floor(Date.now() / 1000) + 900)
    )
    await getCoreToken()
    await getCoreToken({ force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('re-mints after clearCoreToken (logout / identity switch)', async () => {
    const fetchMock = mockFetchReturning(
      jwt(Math.floor(Date.now() / 1000) + 900)
    )
    await getCoreToken()
    clearCoreToken()
    await getCoreToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a token already within the 60s refresh margin', async () => {
    const fetchMock = mockFetchReturning(
      jwt(Math.floor(Date.now() / 1000) + 30)
    )
    await getCoreToken()
    await getCoreToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when the endpoint responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    )
    await expect(getCoreToken()).rejects.toThrow(/401/)
  })
})

describe('getCoreToken rejection handling', () => {
  beforeEach(() => {
    clearCoreToken()
    vi.restoreAllMocks()
  })

  it('still surfaces the mint failure to a caller that awaits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    )

    await expect(getCoreToken()).rejects.toThrow(
      'core credential mint rejected: 401'
    )
  })
})
