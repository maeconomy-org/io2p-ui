import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { usePreference, resolve } from '@/hooks/ui/use-preference'
import { queryKeys } from '@/lib/query-keys'

const USER = { id: 'user-a', identities: [], preferences: {} as never }

let authState: { preferences?: unknown; authLoading: boolean } = {
  preferences: undefined,
  authLoading: false,
}
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const setStored = (preferences: Record<string, Record<string, unknown>>) => {
  authState.preferences = preferences
  queryClient.setQueryData(queryKeys.users.current, { ...USER, preferences })
}

describe('usePreference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    authState = { preferences: undefined, authLoading: false }
    queryClient.setQueryData(queryKeys.users.current, USER)
    updatePreferences.mockResolvedValue({})
  })

  it('returns the hardcoded default when the node has nothing stored', () => {
    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    expect(result.current[0]).toBe('table')
  })

  it('reads the value the node returned with /me', () => {
    setStored({ ui: { objectsView: 'columns' } })
    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    expect(result.current[0]).toBe('columns')
  })

  it('patches only the key that changed, under its namespace', async () => {
    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })

    act(() => result.current[1]('columns'))

    // A merge patch of one key is what lets two devices change two different
    // preferences without either overwriting the other.
    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { objectsView: 'columns' },
      })
    )
  })

  it('routes onboarding keys to the onboarding namespace', async () => {
    const { result } = renderHook(() => usePreference('toursSeen'), { wrapper })

    act(() => result.current[1](['initial-login']))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        onboarding: { toursSeen: ['initial-login'] },
      })
    )
  })

  it('flips the cached value immediately rather than after the round trip', async () => {
    let release: (value: unknown) => void = () => {}
    updatePreferences.mockReturnValue(
      new Promise((resolvePromise) => {
        release = resolvePromise
      })
    )

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() => {
      const cached = queryClient.getQueryData<{
        preferences: Record<string, Record<string, unknown>>
      }>(queryKeys.users.current)
      expect(cached?.preferences.ui.objectsView).toBe('columns')
    })

    act(() => release({}))
  })

  it('rolls the cache back when the write fails', async () => {
    setStored({ ui: { objectsView: 'table' } })
    updatePreferences.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() => {
      const cached = queryClient.getQueryData<{
        preferences: Record<string, Record<string, unknown>>
      }>(queryKeys.users.current)
      expect(cached?.preferences.ui.objectsView).toBe('table')
    })
  })

  it('takes the node’s merged result over the optimistic guess', async () => {
    // Another device may have changed a DIFFERENT key while this write was in
    // flight; the response carries both.
    updatePreferences.mockResolvedValue({
      ui: { objectsView: 'columns', filesView: 'grid' },
    })

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() => {
      const cached = queryClient.getQueryData<{
        preferences: Record<string, Record<string, unknown>>
      }>(queryKeys.users.current)
      expect(cached?.preferences.ui.filesView).toBe('grid')
    })
  })

  it('is unresolved while auth is still loading', () => {
    authState = { preferences: undefined, authLoading: true }
    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    expect(result.current[2]).toBe(false)
  })

  describe('resolve', () => {
    it('falls back to the default for a value that fails validation', () => {
      expect(resolve({ ui: { objectsView: 'bogus' } }, 'objectsView')).toBe(
        'table'
      )
      expect(resolve(undefined, 'processView')).toBe('table')
      expect(resolve({}, 'toursSeen')).toEqual([])
    })

    it('accepts a stored value that validates', () => {
      expect(
        resolve({ onboarding: { toursSeen: ['a', 'b'] } }, 'toursSeen')
      ).toEqual(['a', 'b'])
    })
  })
})
