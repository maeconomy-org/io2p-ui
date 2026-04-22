import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useObjects } from '@/hooks/api/use-objects'

const getObjects = vi.fn()

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    node: { getObjects },
  }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, queryClient }
}

describe('useObjects.useObjectsByUUIDs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dedupes duplicate UUIDs before fetching', async () => {
    getObjects.mockImplementation(async ({ uuid }: { uuid: string }) => [
      { uuid, name: `Object ${uuid}` },
    ])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['a', 'a', 'b', 'a']),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getObjects).toHaveBeenCalledTimes(2)
    const calledUuids = getObjects.mock.calls.map((c) => c[0].uuid).sort()
    expect(calledUuids).toEqual(['a', 'b'])
  })

  it('returns empty array when no UUIDs supplied', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs([], { enabled: true }),
      { wrapper }
    )

    // disabled because uuids.length === 0
    expect(result.current.isFetched).toBe(false)
    expect(getObjects).not.toHaveBeenCalled()
  })

  it('filters falsy UUIDs before calling API', async () => {
    getObjects.mockImplementation(async ({ uuid }: { uuid: string }) => [
      { uuid, name: `Object ${uuid}` },
    ])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['a', '', 'b']),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getObjects).toHaveBeenCalledTimes(2)
  })

  it('omits soft-deleted versions and returns the newest live version per uuid', async () => {
    getObjects.mockImplementation(async ({ uuid }: { uuid: string }) => {
      if (uuid === 'a') {
        return [
          {
            uuid: 'a',
            name: 'Old live',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          {
            uuid: 'a',
            name: 'Deleted',
            softDeleted: true,
            updatedAt: '2026-03-01T00:00:00Z',
          },
          {
            uuid: 'a',
            name: 'Newest live',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ]
      }
      return []
    })

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['a'], { includeDeleted: false }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({ name: 'Newest live' })
  })

  it('falls back to the newest deleted version when no live version exists', async () => {
    getObjects.mockImplementation(async () => [
      {
        uuid: 'a',
        name: 'Older deleted',
        softDeleted: true,
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        uuid: 'a',
        name: 'Newer deleted',
        softDeleted: true,
        updatedAt: '2026-02-01T00:00:00Z',
      },
    ])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['a'], { includeDeleted: false }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]).toMatchObject({ name: 'Newer deleted' })
  })

  it('returns all versions when includeDeleted is true', async () => {
    getObjects.mockImplementation(async () => [
      { uuid: 'a', name: 'live' },
      { uuid: 'a', name: 'deleted', softDeleted: true },
    ])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['a'], { includeDeleted: true }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(getObjects).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'a', softDeleted: true })
    )
  })

  it('swallows per-UUID fetch errors without failing the whole query', async () => {
    getObjects.mockImplementation(async ({ uuid }: { uuid: string }) => {
      if (uuid === 'bad') throw new Error('boom')
      return [{ uuid, name: 'ok' }]
    })

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjects().useObjectsByUUIDs(['good', 'bad']),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((o) => o.name)).toContain('ok')
  })
})
