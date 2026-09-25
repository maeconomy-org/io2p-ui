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
})
