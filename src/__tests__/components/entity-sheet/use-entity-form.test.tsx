import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ObjectDTO } from 'io2p-client'

import { useEntityForm } from '@/components/entity-sheet/hooks/use-entity-form'

const objects = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
  children: vi.fn(),
  subtree: vi.fn(),
}
const files = { upload: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects, files }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function entity(over: Partial<ObjectDTO> = {}): ObjectDTO {
  return {
    id: 'o1',
    name: 'Wall A',
    currentVersion: 3,
    properties: [],
    parents: [],
    ...over,
  } as ObjectDTO
}

describe('useEntityForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: submits buildCreateObjectInput and reports the new id', async () => {
    objects.create.mockResolvedValue({ id: 'new-1', operationId: 'op' })
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.form.setValue('name', 'Wall A'))
    await act(async () => {
      await result.current.submit()
    })

    expect(objects.create).toHaveBeenCalledWith({ name: 'Wall A' }, undefined)
    expect(onSaved).toHaveBeenCalledWith('new-1')
  })

  it('create: presets default parent ids', async () => {
    objects.create.mockResolvedValue({ id: 'new-2' })
    const { result } = renderHook(
      () => useEntityForm(null, { defaultParentIds: ['p1'] }),
      { wrapper: makeWrapper() }
    )

    act(() => result.current.form.setValue('name', 'Child'))
    await act(async () => {
      await result.current.submit()
    })

    expect(objects.create).toHaveBeenCalledWith(
      { name: 'Child', parents: ['p1'] },
      undefined
    )
  })

  it('create: uploads pending files first, then authors their minted ids', async () => {
    objects.create.mockResolvedValue({ id: 'new-3' })
    files.upload.mockResolvedValue({ file: { id: 'file-1' } })
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'With File')
      result.current.form.setValue('properties', [
        {
          key: 'spec',
          values: [
            {
              data: 'v',
              files: [
                {
                  _localId: 'l1',
                  kind: 'upload' as const,
                  blob: new File(['x'], 'a.pdf'),
                },
              ],
            },
          ],
        },
      ])
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(files.upload).toHaveBeenCalledTimes(1)
    expect(objects.create).toHaveBeenCalledWith(
      {
        name: 'With File',
        properties: [
          {
            key: 'spec',
            values: [
              {
                data: 'v',
                ref: undefined,
                files: [{ kind: 'upload', id: 'file-1' }],
              },
            ],
          },
        ],
      },
      undefined
    )
    expect(onSaved).toHaveBeenCalledWith('new-3')
  })

  it('aborts the save (and toasts) when an upload fails', async () => {
    files.upload.mockRejectedValue(new Error('boom'))
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'X')
      result.current.form.setValue('properties', [
        {
          key: 'spec',
          values: [
            {
              data: 'v',
              files: [
                {
                  _localId: 'l1',
                  kind: 'upload' as const,
                  blob: new File(['x'], 'a.pdf'),
                },
              ],
            },
          ],
        },
      ])
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(objects.create).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('objects.files.uploadFailed')
  })

  it('edit with no changes: no update call (empty diff), still reports saved', async () => {
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(entity(), { onSaved }), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(objects.update).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith('o1')
  })

  it('edit with a change: PATCHes the diff with if-match = currentVersion', async () => {
    objects.update.mockResolvedValue(entity({ currentVersion: 4 }))
    const { result } = renderHook(() => useEntityForm(entity()), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.form.setValue('name', 'Wall B'))
    await act(async () => {
      await result.current.submit()
    })

    expect(objects.update).toHaveBeenCalledWith(
      'o1',
      { name: 'Wall B' },
      { ifMatch: 3 }
    )
  })

  it('reloads the form when a different entity arrives', async () => {
    const { result, rerender } = renderHook(
      ({ e }: { e: ObjectDTO }) => useEntityForm(e),
      { wrapper: makeWrapper(), initialProps: { e: entity() } }
    )

    expect(result.current.form.getValues('name')).toBe('Wall A')

    rerender({ e: entity({ id: 'o2', name: 'Wall C', currentVersion: 1 }) })
    await waitFor(() =>
      expect(result.current.form.getValues('name')).toBe('Wall C')
    )
  })
})
