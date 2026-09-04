import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  ROLLUP_POLL_MS,
  rollupPollInterval,
  useObjects,
  useProcesses,
  useTemplates,
} from '@/hooks/api/entities'

const objects = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
  children: vi.fn(),
  subtree: vi.fn(),
  rollups: vi.fn(),
}

const templates = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects, processes: objects, templates }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper }
}

describe('entities hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useObjects exposes the entity verbs + hierarchy', () => {
    const api = useObjects()
    expect(Object.keys(api).sort()).toEqual(
      [
        'useChildren',
        'useCreate',
        'useGet',
        'useList',
        'usePrefetchDetail',
        'useRemove',
        'useRestore',
        'useRollups',
        'useSubtree',
        'useUpdate',
      ].sort()
    )
  })

  it('useProcesses exposes the entity verbs (no hierarchy)', () => {
    const api = useProcesses()
    expect('useChildren' in api).toBe(false)
    expect(typeof api.useList).toBe('function')
    expect(typeof api.useCreate).toBe('function')
  })

  it('useChildren fetches the parent’s children and is disabled without a parentId', async () => {
    const page = {
      data: [{ id: 'c1', name: 'child' }],
      page: { number: 1, size: 20, totalElements: 1, totalPages: 1 },
    }
    objects.children.mockResolvedValue(page)

    const { wrapper } = makeWrapper()
    const { result, rerender } = renderHook(
      ({ pid }: { pid?: string }) => useObjects().useChildren(pid),
      { wrapper, initialProps: { pid: undefined as string | undefined } }
    )

    expect(result.current.isFetched).toBe(false)
    expect(objects.children).not.toHaveBeenCalled()

    rerender({ pid: 'p1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(objects.children).toHaveBeenCalledWith(
      'p1',
      undefined,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.current.data).toEqual(page)
  })

  it('useTemplates exposes the entity verbs (no hierarchy) plus share deps', () => {
    const api = useTemplates()
    expect(Object.keys(api).sort()).toEqual(
      [
        'useCreate',
        'useGet',
        'useList',
        'useRemove',
        'useRestore',
        'useShareDependencies',
        'useShareDependenciesFor',
        'useUpdate',
      ].sort()
    )
  })

  it('useTemplates().useList queries client.templates.list', async () => {
    const page = {
      data: [{ id: 't1', name: 'Steel wall', type: 'object', system: false }],
      page: { number: 1, size: 20, totalElements: 1, totalPages: 1 },
    }
    templates.list.mockResolvedValue(page)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useTemplates().useList({ page: 1, size: 20 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(templates.list).toHaveBeenCalledWith(
      { page: 1, size: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.current.data).toEqual(page)
  })

  it('useTemplates().useRemove deletes by id', async () => {
    templates.delete.mockResolvedValue({ id: 't1' })

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTemplates().useRemove(), { wrapper })

    await result.current.mutateAsync({ id: 't1' })
    expect(templates.delete).toHaveBeenCalledWith('t1')
  })

  it('useRollups is disabled until an id AND ownership are known', async () => {
    objects.rollups.mockResolvedValue({ data: [] })
    const { wrapper } = makeWrapper()

    // A non-owner must never fire the request: the node answers 404, so asking is a guaranteed
    // failure rather than a permission the UI could recover from.
    const { result, rerender } = renderHook(
      ({ id, owner }: { id?: string; owner: boolean }) =>
        useObjects().useRollups(id, { enabled: owner }),
      { wrapper, initialProps: { id: 'o1', owner: false } }
    )

    expect(result.current.isFetched).toBe(false)
    expect(objects.rollups).not.toHaveBeenCalled()

    rerender({ id: 'o1', owner: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(objects.rollups).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('rollupPollInterval polls while an entry is stale and stops when none are', () => {
    const entry = (stale: boolean, computedAt: number | null = 1_700_000) => ({
      ruleId: 'r1',
      propertyKey: 'mass',
      buckets: [],
      skippedCount: 0,
      stale,
      computedAt,
    })

    // One stale entry is enough — that rule's recompute is still queued.
    expect(rollupPollInterval({ data: [entry(false), entry(true)] })).toBe(
      ROLLUP_POLL_MS
    )
    expect(rollupPollInterval({ data: [entry(false)] })).toBe(false)
    // Nothing fetched yet, and the empty case: no rule, nothing to wait for.
    expect(rollupPollInterval(undefined)).toBe(false)
    expect(rollupPollInterval({ data: [] })).toBe(false)
  })

  it('rollupPollInterval ignores an entry the worker has never computed', () => {
    // `computedAt: null` is `stale: true` by construction, and only a WRITE to
    // the subtree queues the worker — so polling it re-reads the same
    // synthesized entry every 30s for as long as the sheet stays open.
    const never = {
      ruleId: 'r1',
      propertyKey: 'mass',
      buckets: [],
      skippedCount: 0,
      stale: true,
      computedAt: null,
    }

    expect(rollupPollInterval({ data: [never] })).toBe(false)
  })
})
