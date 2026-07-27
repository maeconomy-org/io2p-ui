import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
  ValidationError,
  type ObjectDTO,
} from 'io2p-client'

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

// A committed object (create/get response) with the property + value ids uploads resolve against.
const committed = {
  id: 'new-3',
  name: 'With File',
  currentVersion: 1,
  properties: [{ id: 'cp1', key: 'spec', values: [{ id: 'cv1', data: 'v' }] }],
}
const draftWithUpload = () => [
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
]

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
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

  it('create: saves first, then uploads pending files against the committed ids', async () => {
    objects.create.mockResolvedValue(committed)
    files.upload.mockResolvedValue({ file: { id: 'file-1' } })
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'With File')
      result.current.form.setValue('properties', draftWithUpload())
    })
    await act(async () => {
      await result.current.submit()
    })

    // No upload authored in the create body (references only).
    expect(objects.create).toHaveBeenCalledWith(
      {
        name: 'With File',
        properties: [{ key: 'spec', values: [{ data: 'v', ref: undefined }] }],
      },
      undefined
    )
    // The upload attaches AFTER the save, targeting the committed value.
    expect(files.upload).toHaveBeenCalledTimes(1)
    expect(files.upload.mock.calls[0][1]).toEqual({
      entityId: 'new-3',
      propertyId: 'cp1',
      valueId: 'cv1',
    })
    expect(onSaved).toHaveBeenCalledWith('new-3')
  })

  it('a failed upload toasts but does NOT roll back the saved entity', async () => {
    objects.create.mockResolvedValue(committed)
    files.upload.mockRejectedValue(new Error('boom'))
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'With File')
      result.current.form.setValue('properties', draftWithUpload())
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(objects.create).toHaveBeenCalledTimes(1) // entity was saved
    expect(toastError).toHaveBeenCalledWith('objects.files.uploadFailed')
    expect(onSaved).toHaveBeenCalledWith('new-3') // save still reported
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

  it('a failed save keeps the draft, reports nothing saved, and never rejects', async () => {
    objects.update.mockRejectedValue(
      new PreconditionFailedError({
        type: 'about:blank',
        title: 'Precondition Failed',
        status: 412,
      })
    )
    const onSaved = vi.fn()
    const { result } = renderHook(
      () => {
        const r = useEntityForm(entity(), { onSaved })
        // RHF's formState is a proxy that only tracks fields read during render, exactly as
        // EntitySheet reads them — without this the hook never subscribes to isDirty.
        void r.form.formState.isDirty
        return r
      },
      { wrapper: makeWrapper() }
    )

    act(() =>
      result.current.form.setValue('name', 'Wall B', {
        shouldDirty: true,
      })
    )
    await act(async () => {
      // Must resolve: RHF rethrows whatever the handler throws, which would be an unhandled rejection.
      await expect(result.current.submit()).resolves.toBeUndefined()
    })

    expect(toastError).toHaveBeenCalledWith('objects.saveError.conflict')
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.form.formState.isDirty).toBe(true)
    expect(result.current.form.getValues('name')).toBe('Wall B')
    expect(files.upload).not.toHaveBeenCalled()
  })

  it('surfaces the server detail when a save is rejected as invalid', async () => {
    objects.update.mockRejectedValue(
      new ValidationError({
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'property key must be unique',
      })
    )
    const { result } = renderHook(() => useEntityForm(entity()), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.form.setValue('name', 'Wall B'))
    await act(async () => {
      await result.current.submit()
    })

    expect(toastError).toHaveBeenCalledWith(
      'objects.saveError.invalid:{"detail":"property key must be unique"}'
    )
  })

  it('maps the remaining save failures to their own messages', async () => {
    const cases: [Error, string][] = [
      [
        new ForbiddenError({
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
        }),
        'objects.permissionDenied',
      ],
      [
        new NotFoundError({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
        }),
        'objects.saveError.notFound',
      ],
      [
        new UnauthorizedError({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
        }),
        'common.sessionExpired',
      ],
      [new Error('Failed to fetch'), 'common.saveFailed'],
    ]

    for (const [error, key] of cases) {
      vi.clearAllMocks()
      objects.update.mockRejectedValue(error)
      const { result, unmount } = renderHook(() => useEntityForm(entity()), {
        wrapper: makeWrapper(),
      })
      act(() => result.current.form.setValue('name', 'Wall B'))
      await act(async () => {
        await result.current.submit()
      })
      expect(toastError).toHaveBeenCalledWith(key)
      unmount()
    }
  })

  it('a failed create does not report a save', async () => {
    objects.create.mockRejectedValue(new Error('boom'))
    const onSaved = vi.fn()
    const { result } = renderHook(() => useEntityForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.form.setValue('name', 'Wall A'))
    await act(async () => {
      await result.current.submit()
    })

    expect(toastError).toHaveBeenCalledWith('common.saveFailed')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('stays submitting while the post-save upload is still in flight', async () => {
    objects.create.mockResolvedValue(committed)
    let release: () => void = () => {}
    files.upload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve()
        })
    )
    const { result } = renderHook(() => useEntityForm(null), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'With File')
      result.current.form.setValue('properties', draftWithUpload())
    })

    let submitted: Promise<void> = Promise.resolve()
    act(() => {
      submitted = result.current.submit()
    })

    // The entity write has resolved but the bytes have not — Save must still read as busy.
    await waitFor(() => expect(files.upload).toHaveBeenCalled())
    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      release()
      await submitted
    })
    expect(result.current.isSubmitting).toBe(false)
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
