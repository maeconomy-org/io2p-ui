import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useFormulas, useConstants, useUnits } from '@/hooks/api/leaves'
import { queryKeys } from '@/lib/query-keys'

const formulas = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}
const constants = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  appendVersion: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}

const units = { all: vi.fn(), list: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ formulas, constants, units }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return Object.assign(wrapper, { queryClient })
}

describe('leaf hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useFormulas exposes list/get/create/remove/restore (no update)', () => {
    const api = useFormulas()
    expect(Object.keys(api).sort()).toEqual(
      ['useCreate', 'useGet', 'useList', 'useRemove', 'useRestore'].sort()
    )
  })

  it('useFormulas().useList queries client.formulas.list', async () => {
    const page = {
      data: [
        { id: 'f1', name: 'Area', expression: 'w*h', variables: ['w', 'h'] },
      ],
      page: { number: 1, size: 20, totalElements: 1, totalPages: 1 },
    }
    formulas.list.mockResolvedValue(page)

    const { result } = renderHook(
      () => useFormulas().useList({ page: 1, size: 20 }),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(formulas.list).toHaveBeenCalledWith(
      { page: 1, size: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.current.data).toEqual(page)
  })

  it('useFormulas().useRemove deletes by id', async () => {
    formulas.delete.mockResolvedValue({ id: 'f1' })
    const { result } = renderHook(() => useFormulas().useRemove(), {
      wrapper: makeWrapper(),
    })
    await result.current.mutateAsync({ id: 'f1' })
    expect(formulas.delete).toHaveBeenCalledWith('f1', undefined)
  })

  it('useConstants exposes list/get/byIds/create/appendVersion/remove/restore', () => {
    const api = useConstants()
    expect(Object.keys(api).sort()).toEqual(
      [
        'useAppendVersion',
        'useByIds',
        'useCreate',
        'useGet',
        'useList',
        'useRemove',
        'useRestore',
      ].sort()
    )
  })

  // A calc names its constants by id, and the picker's search page may hold none of them — so this
  // fetches each one directly and keys the result by id for the caller to look up.
  it('useConstants().useByIds resolves each id into a map', async () => {
    constants.get.mockImplementation((id: string) =>
      Promise.resolve({ id, name: `name-${id}`, versions: [] })
    )
    const { result } = renderHook(() => useConstants().useByIds(['c1', 'c2']), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.size).toBe(2))
    expect(result.current.get('c1')?.name).toBe('name-c1')
    expect(constants.get).toHaveBeenCalledTimes(2)
  })

  it('useConstants().useByIds asks for nothing when there is nothing bound', () => {
    const { result } = renderHook(() => useConstants().useByIds([]), {
      wrapper: makeWrapper(),
    })

    expect(result.current.size).toBe(0)
    expect(constants.get).not.toHaveBeenCalled()
  })

  it('useConstants().useRestore brings a deleted constant back', async () => {
    // The API had `restore` all along; the bundle simply never exposed it, so a deleted constant
    // could not come back — against the never-delete-data rule.
    constants.restore.mockResolvedValue({ id: 'c1' })
    const { result } = renderHook(() => useConstants().useRestore(), {
      wrapper: makeWrapper(),
    })
    await result.current.mutateAsync({ id: 'c1' })
    expect(constants.restore).toHaveBeenCalledWith('c1', undefined)
  })

  it('useConstants().useAppendVersion appends a version', async () => {
    constants.appendVersion.mockResolvedValue({ id: 'c1' })
    const { result } = renderHook(() => useConstants().useAppendVersion(), {
      wrapper: makeWrapper(),
    })
    await result.current.mutateAsync({ id: 'c1', body: { data: '9.81' } })
    expect(constants.appendVersion).toHaveBeenCalledWith('c1', { data: '9.81' })
  })

  it('useUnits reads the vocabulary unwrapped', async () => {
    const vocabulary = [
      {
        symbol: 'kg',
        dimension: 'mass',
        aliases: [],
        canonical: true,
        toCanonical: 1,
      },
    ]
    units.all.mockResolvedValue(vocabulary)

    const { result } = renderHook(() => useUnits(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(units.all).toHaveBeenCalled()
    expect(result.current.data).toEqual(vocabulary)
  })

  // A correction WRITES to the target — the node stamps its `supersededBy` in the same command.
  // Every surface that warns about supersession reads the target through `useGet`, so without this
  // the formula just marked wrong keeps reading as fine until its entry ages out.
  it('a correction invalidates the formula it supersedes', async () => {
    formulas.create.mockResolvedValue({ id: 'f-2' })
    const wrapper = makeWrapper()
    const spy = vi.spyOn(wrapper.queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useFormulas().useCreate(), { wrapper })
    await result.current.mutateAsync({
      body: { name: 'Fixed', expression: 'a * 2', correctionOf: 'f-1' },
    })

    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.formulas.detail('f-1'),
    })
  })

  it('an ordinary create touches only the lists', async () => {
    formulas.create.mockResolvedValue({ id: 'f-3' })
    const wrapper = makeWrapper()
    const spy = vi.spyOn(wrapper.queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useFormulas().useCreate(), { wrapper })
    await result.current.mutateAsync({
      body: { name: 'New', expression: 'a * 2' },
    })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.formulas.lists(),
    })
  })
})
