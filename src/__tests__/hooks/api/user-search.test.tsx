import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useUserSearch } from '@/hooks/api/users'

const list = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { list } }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper }
}

/**
 * Regression: this once asked for `size: 200` while the node caps `size` at 100, so `GET /v1/users`
 * 400'd every time — and nothing surfaced, because the caller just fell back to raw ids. The Owner
 * column quietly showed uuids, which reads as "the API has no names" rather than as a bug.
 *
 * Asserted on the REQUEST rather than on the source text. The original pinned the literal by
 * reading the file, and broke the moment the constant was extracted — passing or failing on how the
 * value was spelled rather than on what got sent.
 */
describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({
      data: [],
      page: { number: 1, size: 20, totalElements: 0, totalPages: 0 },
    })
  })

  it('never requests more than the node ceiling of 100', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useUserSearch(''), { wrapper })

    await waitFor(() => expect(list).toHaveBeenCalled())
    const { size } = list.mock.calls[0][0]
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThanOrEqual(100)
  })

  it('searches server-side, so a picker can reach past the first page', async () => {
    // Filtering a fixed page client-side cannot find the 101st user; `q` can.
    const { wrapper } = makeWrapper()
    renderHook(() => useUserSearch('  anna  '), { wrapper })

    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(list.mock.calls[0][0]).toMatchObject({ q: 'anna' })
  })

  it('omits `q` entirely when the query is blank, rather than sending an empty one', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useUserSearch('   '), { wrapper })

    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(list.mock.calls[0][0].q).toBeUndefined()
  })
})
