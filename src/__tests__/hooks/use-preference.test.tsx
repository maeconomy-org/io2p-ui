import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  usePreference,
  useFlagPreference,
  resolve,
  resolveFlag,
  applyPatch,
} from '@/hooks/ui/use-preference'
import { queryKeys } from '@/lib/query-keys'

const USER = { id: 'user-a', identities: [], preferences: {} as never }

let authState: {
  preferences?: unknown
  authLoading: boolean
  isAuthenticated?: boolean
} = {
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
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: true,
    }
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
    authState = {
      preferences: undefined,
      authLoading: true,
      isAuthenticated: true,
    }
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

describe('the `key` override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: true,
    }
    queryClient.setQueryData(queryKeys.users.current, USER)
    updatePreferences.mockResolvedValue({})
  })

  // `locale` is stored as `locale.app`, so a patch keyed on the registry name
  // would write `locale.locale` and the server render would never see it.
  it('writes locale under its storage key, not its registry key', async () => {
    const { result } = renderHook(() => usePreference('locale'), { wrapper })

    act(() => result.current[1]('nl'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({ locale: { app: 'nl' } })
    )
  })

  it('reads locale back through the same storage key', () => {
    setStored({ locale: { app: 'nl' } })
    const { result } = renderHook(() => usePreference('locale'), { wrapper })
    expect(result.current[0]).toBe('nl')
  })

  // The auth pages carry their own theme and language controls, and there is no account yet to
  // store a choice on. The cookie the caller writes still drives the next server render, so the
  // change takes effect — attempting the account write as well only 401s, once per click.
  it('skips the account write when nobody is signed in', async () => {
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: false,
    }
    const { result } = renderHook(() => usePreference('locale'), { wrapper })

    act(() => result.current[1]('nl'))

    await waitFor(() => expect(updatePreferences).not.toHaveBeenCalled())
  })
})

describe('useFlagPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: true,
    }
    queryClient.setQueryData(queryKeys.users.current, USER)
    updatePreferences.mockResolvedValue({})
  })

  const render = () =>
    renderHook(() => useFlagPreference('onboarding', 'hint-object'), {
      wrapper,
    })

  it('is false when nothing is stored', () => {
    expect(render().result.current[0]).toBe(false)
  })

  it('reads a stored true', () => {
    setStored({ onboarding: { 'hint-object': true } })
    expect(render().result.current[0]).toBe(true)
  })

  // A flag is a one-way latch, so anything other than `true` reads as unset.
  it('treats a stored false or a truthy string as unset', () => {
    setStored({ onboarding: { 'hint-object': false } })
    expect(render().result.current[0]).toBe(false)
    setStored({ onboarding: { 'hint-object': 'yes' } })
    expect(render().result.current[0]).toBe(false)
  })

  it('marks exactly its own key, leaving its siblings alone', async () => {
    const { result } = render()

    act(() => result.current[1]())

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        onboarding: { 'hint-object': true },
      })
    )
  })

  it('follows authLoading for `resolved`', () => {
    authState = {
      preferences: undefined,
      authLoading: true,
      isAuthenticated: true,
    }
    expect(render().result.current[2]).toBe(false)
  })
})

describe('applyPatch', () => {
  it('merges one namespace without dropping the others', () => {
    expect(
      applyPatch({ ui: { objectsView: 'table' } }, { onboarding: { a: true } })
    ).toEqual({ ui: { objectsView: 'table' }, onboarding: { a: true } })
  })

  it('overwrites a present key and keeps its neighbours', () => {
    expect(
      applyPatch(
        { ui: { objectsView: 'table', theme: 'dark' } },
        { ui: { objectsView: 'columns' } }
      )
    ).toEqual({ ui: { objectsView: 'columns', theme: 'dark' } })
  })

  // `null` is the node's delete sentinel, not a stored value.
  it('deletes on null', () => {
    expect(
      applyPatch({ ui: { theme: 'dark' } }, { ui: { theme: null } })
    ).toEqual({ ui: {} })
  })

  it('tolerates an undefined starting bag', () => {
    expect(applyPatch(undefined, { ui: { theme: 'dark' } })).toEqual({
      ui: { theme: 'dark' },
    })
  })
})

describe('resolveFlag', () => {
  it('is true only for a stored true', () => {
    expect(resolveFlag({ onboarding: { a: true } }, 'onboarding', 'a')).toBe(
      true
    )
    expect(resolveFlag({ onboarding: { a: 1 } }, 'onboarding', 'a')).toBe(false)
    expect(resolveFlag(undefined, 'onboarding', 'a')).toBe(false)
    expect(resolveFlag({}, 'onboarding', 'a')).toBe(false)
  })
})

describe('usePreference on a cold load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    // `/me` still in flight: no cached user, and `preferences` undefined.
    authState = {
      preferences: undefined,
      authLoading: false,
      isAuthenticated: true,
    }
  })

  // Regression: `onMutate` used to `cancelQueries` on `users.current` — the very query whose
  // cached user the optimistic write needs. On a cold load that aborted `/me`, so the write found
  // no user, returned it untouched, and the control snapped back to its default while the PATCH
  // succeeded. Observed on the wire as an aborted `/me` beside a 200 on `/me/preferences`.
  it('does not cancel the in-flight /me that the optimistic write depends on', async () => {
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries')
    updatePreferences.mockResolvedValue({ ui: { objectsView: 'columns' } })

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() => expect(updatePreferences).toHaveBeenCalled())
    expect(cancelQueries).not.toHaveBeenCalled()
  })

  it('still sends the patch when no user is cached yet', async () => {
    updatePreferences.mockResolvedValue({ ui: { objectsView: 'columns' } })

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { objectsView: 'columns' },
      })
    )
  })

  it('refetches /me once the write settles, so the cache converges', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    updatePreferences.mockResolvedValue({ ui: { objectsView: 'columns' } })

    const { result } = renderHook(() => usePreference('objectsView'), {
      wrapper,
    })
    act(() => result.current[1]('columns'))

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.users.current,
      })
    )
  })
})
