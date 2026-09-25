import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ONBOARDING_EPOCH } from '@/constants'
import { queryKeys } from '@/lib/query-keys'

const USER = 'user-uuid'
const authState: {
  isAuthenticated: boolean
  authLoading: boolean
  userId?: string
  preferences?: Record<string, Record<string, unknown>>
} = {
  isAuthenticated: true,
  authLoading: false,
  userId: USER,
  preferences: undefined,
}
vi.mock('@/contexts', () => ({ useAuth: () => authState }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

import { useTourSeen } from '@/components/onboarding/use-onboarding'

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const mount = () => renderHook(() => useTourSeen('tour-a'), { wrapper })

describe('useTourSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.preferences = undefined
    updatePreferences.mockResolvedValue({})
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(queryKeys.users.current, {
      id: USER,
      identities: [],
      preferences: {},
    })
  })

  it('is unresolved until the account record arrives', () => {
    const { result } = mount()
    expect(result.current.resolved).toBe(false)
  })

  it('resolves once the record is present, even when it holds no tour state', () => {
    authState.preferences = {}
    const { result } = mount()
    expect(result.current.resolved).toBe(true)
    expect(result.current.seen).toBe(false)
  })

  it('reports a tour the account has already seen', () => {
    authState.preferences = {
      onboarding: { toursSeen: ['tour-a'], onboardingEpoch: ONBOARDING_EPOCH },
    }
    const { result } = mount()
    expect(result.current.seen).toBe(true)
  })

  it('keeps the other tours when marking one seen', async () => {
    authState.preferences = {
      onboarding: { toursSeen: ['tour-b'], onboardingEpoch: ONBOARDING_EPOCH },
    }
    const { result } = mount()

    await act(async () => result.current.markSeen())

    const written = updatePreferences.mock.calls.at(-1)?.[0]
    expect(written.onboarding.toursSeen).toEqual(['tour-b', 'tour-a'])
  })

  it('writes nothing before the record arrives', async () => {
    const { result } = mount()

    await act(async () => result.current.markSeen())

    // Unresolved preferences read as epoch 0, which takes the stale branch and REPLACES the
    // list — the account would lose every other tour it had seen.
    expect(updatePreferences).not.toHaveBeenCalled()
  })
})
