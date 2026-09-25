import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { usePageSize } from '@/hooks/ui/use-page-size'
import { queryKeys } from '@/lib/query-keys'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

const USER = { id: 'user-a', identities: [], preferences: {} }

const authState: {
  preferences?: Record<string, unknown>
  authLoading: boolean
  isAuthenticated?: boolean
} = { preferences: {}, authLoading: false, isAuthenticated: true }

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(queryKeys.users.current, USER)
  authState.preferences = {}
  updatePreferences.mockReset()
  updatePreferences.mockResolvedValue({})
})

describe('usePageSize', () => {
  it('starts at the shared default', () => {
    const { result } = renderHook(() => usePageSize(vi.fn()), { wrapper })
    expect(result.current[0]).toBe(DEFAULT_TABLE_PAGE_SIZE)
  })

  it('reads the account value', () => {
    authState.preferences = { defaults: { pageSize: 50 } }
    const { result } = renderHook(() => usePageSize(vi.fn()), { wrapper })
    expect(result.current[0]).toBe(50)
  })

  it('persists the change under `defaults.pageSize`', async () => {
    const { result } = renderHook(() => usePageSize(vi.fn()), { wrapper })

    act(() => result.current[1](50))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        defaults: { pageSize: 50 },
      })
    )
  })

  // Without this, growing the page size on page 4 asks for a page that may no longer exist and
  // the table renders empty.
  it('sends the query back to page 1', () => {
    const onReset = vi.fn()
    const { result } = renderHook(() => usePageSize(onReset), { wrapper })

    act(() => result.current[1](50))

    expect(onReset).toHaveBeenCalled()
  })

  it('ignores a stored size that is not an offered option', () => {
    authState.preferences = { defaults: { pageSize: 999 } }
    const { result } = renderHook(() => usePageSize(vi.fn()), { wrapper })
    expect(result.current[0]).toBe(DEFAULT_TABLE_PAGE_SIZE)
  })
})
