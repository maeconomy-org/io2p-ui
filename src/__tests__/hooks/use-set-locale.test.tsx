import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useSetLocale } from '@/hooks/ui/use-set-locale'
import {
  PREF_COOKIE_NAME,
  clearPreferenceMirrors,
} from '@/constants/preference-cookie'
import { readCookie, writeCookie } from '@/lib/cookies'
import { queryKeys } from '@/lib/query-keys'

const USER = { id: 'user-a', identities: [], preferences: {} }

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    preferences: {},
    authLoading: false,
    isAuthenticated: true,
  }),
}))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  clearPreferenceMirrors()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(queryKeys.users.current, USER)
  updatePreferences.mockResolvedValue({})
})

afterEach(() => clearPreferenceMirrors())

describe('useSetLocale', () => {
  it('stores the language on the account', async () => {
    const { result } = renderHook(() => useSetLocale(), { wrapper })

    act(() => result.current('nl'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({ locale: { app: 'nl' } })
    )
  })

  /**
   * Written here, not left to `PreferenceSync`: its effect has not run yet, and
   * the refreshed request must carry the new value or the server answers in the
   * old language and the click appears to do nothing.
   */
  it('writes the cookie SYNCHRONOUSLY, before the refresh', () => {
    const { result } = renderHook(() => useSetLocale(), { wrapper })

    act(() => result.current('nl'))

    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.....nl')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the other mirrored values when it patches the cookie', () => {
    writeCookie(PREF_COOKIE_NAME, '1.c.n.50.d.en')
    const { result } = renderHook(() => useSetLocale(), { wrapper })

    act(() => result.current('nl'))

    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.c.n.50.d.nl')
  })
})
