import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  checkSave,
  cutName,
  readSavedSearches,
  sameQuery,
  useSavedSearches,
} from '@/hooks/ui/use-saved-searches'
import { queryKeys } from '@/lib/query-keys'
import { savedSearchKey, PREF_KEY_RE } from '@/constants/preferences'

const entry = (name: string, query: string, createdAt = 1) => ({
  name,
  query,
  createdAt,
})

const fullBag = (n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`s-${i}`, entry(`n${i}`, `q${i}`)])
  )

describe('readSavedSearches', () => {
  it('lists the newest first, and by key when two have the same time', () => {
    const { saved } = readSavedSearches({
      search: {
        's-b': entry('B', 'b', 5),
        's-a': entry('A', 'a', 5),
        's-c': entry('C', 'c', 9),
      },
    })
    expect(saved.map((s) => s.key)).toEqual(['s-c', 's-a', 's-b'])
  })

  it('lists an s- entry of another shape as unreadable, and ignores other keys', () => {
    const { saved, unreadable } = readSavedSearches({
      search: {
        's-ok': entry('Ok', 'beton'),
        's-bad': { name: 'x' },
        's-empty': entry(' ', 'beton'),
        recent: ['beton'],
      },
    })
    expect(saved.map((s) => s.key)).toEqual(['s-ok'])
    expect(unreadable).toEqual(['s-bad', 's-empty'])
  })
})

describe('checkSave', () => {
  const none = { search: {} }

  it('refuses an empty name and a name over 80 code points', () => {
    expect(checkSave(none, 's-x', '  ', 'beton')).toEqual({ code: 'name' })
    expect(checkSave(none, 's-x', 'a'.repeat(81), 'beton')).toEqual({
      code: 'name',
    })
    // 80 emoji are 160 UTF-16 units and still 80 code points.
    expect(checkSave(none, 's-x', '😀'.repeat(80), 'beton')).toBeNull()
  })

  it('counts the query in JSON bytes, not characters', () => {
    // 334 CJK characters are 1,002 bytes.
    expect(checkSave(none, 's-x', 'n', '中'.repeat(334))).toEqual({
      code: 'queryTooLong',
    })
    expect(checkSave(none, 's-x', 'n', '中'.repeat(333))).toBeNull()
    // A quote is escaped, so 501 of them are 1,002 bytes.
    expect(checkSave(none, 's-x', 'n', '"'.repeat(501))).toEqual({
      code: 'queryTooLong',
    })
    expect(checkSave(none, 's-x', 'n', 'a'.repeat(1000))).toBeNull()
  })

  it('refuses an empty query', () => {
    expect(checkSave(none, 's-x', 'n', '   ')).toEqual({ code: 'emptyQuery' })
  })

  it('refuses the same text saved again, with runs of spaces folded', () => {
    const prefs = { search: { 's-a': entry('Heavy', 'beton  mass>=2t') } }
    expect(checkSave(prefs, 's-x', 'n', ' beton mass>=2t ')).toEqual({
      code: 'duplicate',
      name: 'Heavy',
    })
  })

  it('takes a retry under a stored key as the same write', () => {
    const prefs = { search: { ...fullBag(49), 's-a': entry('Heavy', 'beton') } }
    expect(checkSave(prefs, 's-a', 'Heavy', 'beton')).toBeNull()
  })

  it('refuses the 51st, counting unreadable entries', () => {
    const prefs = { search: { ...fullBag(49), 's-bad': 'x' } }
    expect(checkSave(prefs, 's-new', 'n', 'beton')).toEqual({ code: 'full' })
    expect(checkSave({ search: fullBag(49) }, 's-new', 'n', 'beton')).toBeNull()
  })

  it('refuses a save that takes the whole search bag over 32 KB, other keys too', () => {
    const big = 'a'.repeat(1000)
    const bag = Object.fromEntries(
      Array.from({ length: 31 }, (_, i) => [`s-${i}`, entry(`n${i}`, big + i)])
    )
    expect(checkSave({ search: bag }, 's-new', 'n', big)).toEqual({
      code: 'tooBig',
    })
    // With 30 the bag is 32,499 bytes and fits; a non-s- key of 300 bytes takes it over.
    const fits = Object.fromEntries(Object.entries(bag).slice(0, 30))
    expect(checkSave({ search: fits }, 's-new', 'n', big)).toBeNull()
    expect(
      checkSave(
        { search: { ...fits, recent: 'x'.repeat(300) } },
        's-new',
        'n',
        big
      )
    ).toEqual({ code: 'tooBig' })
  })
})

describe('helpers', () => {
  it('folds spaces and trims for a duplicate', () => {
    expect(sameQuery('a  b ', ' a b')).toBe(true)
    expect(sameQuery('a b', 'a  c')).toBe(false)
    expect(sameQuery('Steel mass>2T', 'steel MASS>2t')).toBe(true)
  })

  it('cuts a name by code points', () => {
    expect(cutName('😀'.repeat(81))).toBe('😀'.repeat(80))
  })

  it('makes a key the node accepts', () => {
    const key = savedSearchKey()
    expect(key).toMatch(/^s-[0-9a-z]{10}$/)
    expect(key).toMatch(PREF_KEY_RE)
  })
})

const USER = { id: 'user-a', identities: [] }
let authState: {
  preferences?: Record<string, Record<string, unknown>>
  authLoading: boolean
  isAuthenticated: boolean
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

const cached = () =>
  (
    queryClient.getQueryData(queryKeys.users.current) as {
      preferences: Record<string, Record<string, unknown>>
    }
  ).preferences

describe('useSavedSearches', () => {
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
    setStored({ ui: { theme: 'light' }, search: {} })
    updatePreferences.mockResolvedValue({})
  })

  it('is not ready, and sends nothing, before the preferences load', async () => {
    authState.preferences = undefined
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    expect(result.current.ready).toBe(false)
    let out
    await act(async () => {
      out = await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(out).toEqual({ ok: false, reason: { code: 'notReady' } })
    expect(updatePreferences).not.toHaveBeenCalled()
  })

  it('is not ready while signed out', () => {
    authState.isAuthenticated = false
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    expect(result.current.ready).toBe(false)
  })

  it('sends the trimmed entry and shows it only after the node answers', async () => {
    let answer!: (v: unknown) => void
    updatePreferences.mockReturnValue(new Promise((r) => (answer = r)))
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    let pending!: Promise<unknown>
    act(() => {
      pending = result.current.save('s-a', ' Heavy ', ' beton mass>=2t ')
    })
    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        search: {
          's-a': {
            name: 'Heavy',
            query: 'beton mass>=2t',
            createdAt: expect.any(Number),
          },
        },
      })
    )
    expect(cached().search).toEqual({})
    await act(async () => {
      answer({})
      await pending
    })
    expect(cached().search['s-a']).toMatchObject({ name: 'Heavy' })
  })

  it('puts only its own patch in the cache, not the node bag', async () => {
    // The node answers with a bag from before a theme change that is still in flight.
    updatePreferences.mockImplementation(async () => {
      setStored({ ui: { theme: 'dark' }, search: {} })
      return {
        ui: { theme: 'light' },
        search: { 's-a': entry('Heavy', 'beton') },
      }
    })
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    await act(async () => {
      await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(cached().ui.theme).toBe('dark')
    expect(cached().search['s-a']).toBeDefined()
  })

  it('refetches /me after a save and after a failure', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    await act(async () => {
      await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.users.current,
    })
    invalidate.mockClear()
    updatePreferences.mockRejectedValue({ status: 0 })
    await act(async () => {
      await result.current.save('s-b', 'Light', 'hout')
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.users.current,
    })
  })

  it('sends one PATCH for two saves in the same frame', async () => {
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    let outs: unknown[] = []
    await act(async () => {
      outs = await Promise.all([
        result.current.save('s-a', 'Heavy', 'beton'),
        result.current.save('s-a', 'Heavy', 'beton'),
      ])
    })
    expect(updatePreferences).toHaveBeenCalledTimes(1)
    expect(outs).toEqual([
      { ok: true },
      { ok: false, reason: { code: 'busy' } },
    ])
  })

  it('gives the node detail of a 422, and offline for no answer', async () => {
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    updatePreferences.mockRejectedValueOnce({
      status: 422,
      detail: 'Invalid preferences: preferences total 70000 bytes, max 65536',
    })
    let out
    await act(async () => {
      out = await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(out).toEqual({
      ok: false,
      reason: {
        code: 'refused',
        detail: 'Invalid preferences: preferences total 70000 bytes, max 65536',
      },
    })
    updatePreferences.mockRejectedValueOnce({ status: 0, name: 'TimeoutError' })
    await act(async () => {
      out = await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(out).toEqual({ ok: false, reason: { code: 'offline' } })
    updatePreferences.mockRejectedValueOnce({ status: 500 })
    await act(async () => {
      out = await result.current.save('s-a', 'Heavy', 'beton')
    })
    expect(out).toEqual({ ok: false, reason: { code: 'failed' } })
  })

  it('sends while the browser is offline, so the save answers offline and does not wait', async () => {
    onlineManager.setOnline(false)
    try {
      updatePreferences.mockRejectedValueOnce({
        status: 0,
        name: 'NetworkError',
      })
      const { result } = renderHook(() => useSavedSearches(), { wrapper })
      let out
      await act(async () => {
        out = await result.current.save('s-a', 'Heavy', 'beton')
      })
      expect(updatePreferences).toHaveBeenCalledTimes(1)
      expect(out).toEqual({ ok: false, reason: { code: 'offline' } })
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('refuses before sending when a check fails', async () => {
    setStored({ search: { 's-a': entry('Heavy', 'beton') } })
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    let out
    await act(async () => {
      out = await result.current.save('s-b', 'Other', 'beton')
    })
    expect(out).toEqual({
      ok: false,
      reason: { code: 'duplicate', name: 'Heavy' },
    })
    expect(updatePreferences).not.toHaveBeenCalled()
  })

  it('deletes with null, an unreadable entry too, and drops it from the cache', async () => {
    setStored({ search: { 's-a': entry('Heavy', 'beton'), 's-bad': { x: 1 } } })
    const { result } = renderHook(() => useSavedSearches(), { wrapper })
    expect(result.current.unreadable).toEqual(['s-bad'])
    await act(async () => {
      await result.current.remove('s-bad')
    })
    expect(updatePreferences).toHaveBeenCalledWith({
      search: { 's-bad': null },
    })
    expect(cached().search).toEqual({ 's-a': entry('Heavy', 'beton') })
  })
})
