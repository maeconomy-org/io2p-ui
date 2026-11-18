import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createEntityHooks } from '@/hooks/api/create-entity-hooks'

// A fake entity resource — the factory is network-agnostic, so we drive it with spies.
const resource = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}

// The factory reaches the resource via `useIomClient()` → `select(client)`; mock the seam to return
// an object whose `.things` is our fake resource.
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ things: resource }),
}))

// A minimal key namespace mirroring the queryKeys shape the factory needs.
const keys = {
  lists: () => ['things', 'list'] as const,
  list: (query?: unknown) => ['things', 'list', query] as const,
  details: () => ['things', 'detail'] as const,
  detail: (id: string) => ['things', 'detail', id] as const,
}

type Dto = { id: string; name: string }
// The node's lists are lean, so a row is NOT the full entity — the factory takes both types.
type ListDto = { id: string; name: string }

const things = createEntityHooks<
  Dto,
  ListDto,
  { q?: string },
  { name: string },
  Dto,
  { name?: string }
>({
  select: (client: any) => client.things,
  keys,
})

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, queryClient, invalidateSpy }
}

describe('createEntityHooks', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('useList', () => {
    it('calls resource.list with the query and returns the page', async () => {
      const page = {
        data: [{ id: '1', name: 'A' }],
        page: { number: 1, size: 20, totalElements: 1, totalPages: 1 },
      }
      resource.list.mockResolvedValue(page)

      const { wrapper } = makeWrapper()
      const { result } = renderHook(() => things.useList({ q: 'x' }), {
        wrapper,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(resource.list).toHaveBeenCalledWith(
        { q: 'x' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(result.current.data).toEqual(page)
    })

    it('is disabled when enabled=false (no fetch)', () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => things.useList(undefined, { enabled: false }),
        { wrapper }
      )
      expect(result.current.isFetched).toBe(false)
      expect(resource.list).not.toHaveBeenCalled()
    })
  })

  describe('useGet', () => {
    it('fetches by id and stays disabled until an id is present', async () => {
      resource.get.mockResolvedValue({ id: '7', name: 'seven' })

      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        ({ id }: { id?: string }) => things.useGet(id),
        {
          wrapper,
          initialProps: { id: undefined as string | undefined },
        }
      )

      // no id → disabled
      expect(result.current.isFetched).toBe(false)
      expect(resource.get).not.toHaveBeenCalled()

      rerender({ id: '7' })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(resource.get).toHaveBeenCalledWith(
        '7',
        expect.objectContaining({
          enrichFiles: undefined,
          signal: expect.any(AbortSignal),
        })
      )
      expect(result.current.data).toEqual({ id: '7', name: 'seven' })
    })
  })

  describe('useCreate', () => {
    it('creates and invalidates the list scope only', async () => {
      resource.create.mockResolvedValue({ id: 'new', name: 'N' })
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(() => things.useCreate(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ body: { name: 'N' } })
      })

      expect(resource.create).toHaveBeenCalledWith({ name: 'N' }, undefined)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'list'],
      })
    })
  })

  describe('useUpdate', () => {
    it('updates and invalidates both the detail and list scopes', async () => {
      resource.update.mockResolvedValue({ id: '3', name: 'renamed' })
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(() => things.useUpdate(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ id: '3', body: { name: 'renamed' } })
      })

      expect(resource.update).toHaveBeenCalledWith(
        '3',
        { name: 'renamed' },
        undefined
      )
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'detail', '3'],
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'list'],
      })
    })
  })

  describe('useRemove / useRestore', () => {
    it('remove invalidates detail + list', async () => {
      resource.delete.mockResolvedValue({ id: '9', name: 'gone' })
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(() => things.useRemove(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ id: '9' })
      })

      expect(resource.delete).toHaveBeenCalledWith('9', undefined)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'detail', '9'],
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'list'],
      })
    })

    it('restore calls resource.restore and invalidates', async () => {
      resource.restore.mockResolvedValue({ id: '9', name: 'back' })
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(() => things.useRestore(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ id: '9' })
      })

      expect(resource.restore).toHaveBeenCalledWith('9', undefined)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['things', 'detail', '9'],
      })
    })
  })

  describe('useBulkRemove / useBulkRestore', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`)

    // Every request in flight at once (100 on a full page) is what the node's rate limit refuses.
    it('sends at most four requests at a time, and every id once', async () => {
      let inFlight = 0
      let most = 0
      resource.delete.mockImplementation(async () => {
        inFlight += 1
        most = Math.max(most, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 1))
        inFlight -= 1
      })
      const { wrapper } = makeWrapper()
      const { result } = renderHook(() => things.useBulkRemove(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync(ids)
      })

      expect(most).toBe(4)
      expect(resource.delete.mock.calls.map(([id]) => id).sort()).toEqual(
        [...ids].sort()
      )
    })

    it('goes on past a failure and names every id that failed', async () => {
      const refused = new Error('403')
      resource.delete.mockImplementation(async (id: string) => {
        if (id === 'id-2' || id === 'id-7') throw refused
      })
      const { wrapper } = makeWrapper()
      const { result } = renderHook(() => things.useBulkRemove(), { wrapper })

      let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>>
      await act(async () => {
        outcome = await result.current.mutateAsync(ids)
      })

      expect(resource.delete).toHaveBeenCalledTimes(10)
      expect(outcome!.failures).toEqual([
        { id: 'id-2', error: refused },
        { id: 'id-7', error: refused },
      ])
    })

    // One refresh after the batch: a refresh per row refetched the list once for every delete.
    it('refreshes the lists once for the whole batch', async () => {
      resource.restore.mockResolvedValue({})
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(() => things.useBulkRestore(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync(ids)
      })

      expect(resource.restore).toHaveBeenCalledTimes(10)
      const listRefreshes = invalidateSpy.mock.calls.filter(
        ([filters]) =>
          JSON.stringify(filters?.queryKey) ===
          JSON.stringify(['things', 'list'])
      )
      expect(listRefreshes).toHaveLength(1)
    })
  })
})
