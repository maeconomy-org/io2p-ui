import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useFormulas, useConstants } from '@/hooks/api/leaves'

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

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ formulas, constants }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
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
    expect(formulas.list).toHaveBeenCalledWith({ page: 1, size: 20 })
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
})
