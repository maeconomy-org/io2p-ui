// The premise of the picker change: React Query aborts a list request whose query was replaced, as
// long as the request takes the signal. A picker therefore needs only to wait for typing to stop.

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { createTestWrapper } from '@/__tests__/helpers'

const signals: AbortSignal[] = []
const list = vi.fn(
  (_query: unknown, options?: { signal?: AbortSignal }) =>
    new Promise(() => {
      if (options?.signal) signals.push(options.signal)
    })
)

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects: { list } }),
}))

import { useObjects } from '@/hooks/api/entities'

describe('a picker list request', () => {
  it('is aborted when the search text changes before it answers', async () => {
    const { rerender } = renderHook(
      ({ q }) =>
        useObjects().useList(
          { q, size: 20, page: 1, scope: 'all' },
          { keepPreviousData: true }
        ),
      { initialProps: { q: 'st' }, wrapper: createTestWrapper() }
    )
    await waitFor(() => expect(signals).toHaveLength(1))

    rerender({ q: 'steel' })
    await waitFor(() => expect(signals).toHaveLength(2))

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })
})
