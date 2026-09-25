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

  it('rollupPollInterval polls an entry the worker has not computed YET', () => {
    // The node arms every holder when a rule changes, so `computedAt: null` means the
    // first result is on its way. Skipping it refused to poll for the one entry that
    // was about to land, and a rule created over existing data showed nothing until
    // the sheet was reopened.
    const notYet = {
      ruleId: 'r1',
      propertyKey: 'mass',
      buckets: [],
      skippedCount: 0,
      stale: true,
      computedAt: null,
    }

    expect(rollupPollInterval({ data: [notYet] })).toBe(ROLLUP_POLL_MS)
    // Settled and never re-armed: nothing to wait for.
    expect(rollupPollInterval({ data: [{ ...notYet, stale: false }] })).toBe(
      false
    )
  })

  it('a never-computed entry is polled for a BOUNDED window, not forever', () => {
    // The node synthesizes `{stale: true, computedAt: null}` for every visible rule with no
    // state row, and a row exists only for an entity that HOLDS the key or is an ancestor of
    // one. So an object whose subtree holds none of a rule's key is permanently stale — with
    // twelve seeded system rules, that is almost every object, and `stale` alone polled every
    // open sheet every 30s forever.
    const notYet = {
      ruleId: 'r1',
      propertyKey: 'mass',
      buckets: [],
      skippedCount: 0,
      stale: true,
      computedAt: null,
    }

    expect(rollupPollInterval({ data: [notYet] }, 0)).toBe(ROLLUP_POLL_MS)
    expect(rollupPollInterval({ data: [notYet] }, 9)).toBe(ROLLUP_POLL_MS)
    expect(rollupPollInterval({ data: [notYet] }, 10)).toBe(false)
    expect(rollupPollInterval({ data: [notYet] }, 99)).toBe(false)
  })

  it('a stale entry that HAS computed before is polled without a bound', () => {
    // A `computedAt` proves a row exists, so this is a known recompute of a real total —
    // it is definitely moving, and giving up on it would strand the number mid-update.
    const recomputing = {
      ruleId: 'r1',
      propertyKey: 'mass',
      buckets: [],
      skippedCount: 0,
      stale: true,
      computedAt: 1_700_000,
    }

    expect(rollupPollInterval({ data: [recomputing] }, 500)).toBe(
      ROLLUP_POLL_MS
    )
  })
})
