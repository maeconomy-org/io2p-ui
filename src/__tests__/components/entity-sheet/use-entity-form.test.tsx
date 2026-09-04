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
const files = { upload: vi.fn(), uploadAll: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects, files }),
}))

const enqueue = vi.fn()
vi.mock('@/contexts/upload-queue-context', () => ({
  useOptionalUploadQueue: () => ({ enqueue }),
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

  // Uploads are handed to the background queue, so Save no longer waits on bytes — the queue owns
  // per-file progress, failure and retry from here.
  it('does not block the save on the upload finishing', async () => {
    objects.create.mockResolvedValue(committed)
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

    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(files.uploadAll).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith('new-3', [])
  })

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
    expect(onSaved).toHaveBeenCalledWith('new-1', [])
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
    files.uploadAll.mockResolvedValue([
      { status: 'fulfilled', value: { file: { id: 'file-1' } } },
    ])
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
    // The upload attaches AFTER the save, targeting the committed value. uploadAll (not
    // Promise.all(map(upload))) so the per-entity `complete` calls don't fight over the version.
    // One call, per-item targets — the SDK gates completes per entityId, so no grouping here.
    expect(enqueue.mock.calls[0][0][0].target).toEqual({
      entityId: 'new-3',
      propertyId: 'cp1',
      valueId: 'cv1',
    })
    expect(onSaved).toHaveBeenCalledWith('new-3', [])
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
    expect(onSaved).toHaveBeenCalledWith('o1', [])
  })

  // `/objects` lists ROOTS, so linking a parent removes the row the user is looking at. The sheet
  // needs to know WHICH parent to name in the toast that says where it went.
  it('edit: reports the parents this save added, and only the new ones', async () => {
    objects.update.mockResolvedValue(entity({ currentVersion: 4 }))
    const onSaved = vi.fn()
    const { result } = renderHook(
      () =>
        useEntityForm(
          entity({ parents: [{ id: 'old', name: 'Old' }] } as never),
          {
            onSaved,
          }
        ),
      { wrapper: makeWrapper() }
    )

    act(() => result.current.form.setValue('parentIds', ['old', 'fresh']))
    await act(async () => {
      await result.current.submit()
    })

    expect(onSaved).toHaveBeenCalledWith('o1', ['fresh'])
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
    expect(enqueue).not.toHaveBeenCalled()
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

  it('uploads under the renamed filename, not the original File name', async () => {
    objects.create.mockResolvedValue(committed)
    files.uploadAll.mockResolvedValue([
      { status: 'fulfilled', value: { file: { id: 'file-1' } } },
    ])
    const { result } = renderHook(() => useEntityForm(null), {
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
                  blob: new File(['x'], 'IMG_4821.pdf'),
                  fileName: 'Floor plan.pdf',
                  contentType: 'application/pdf',
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

    // A raw File would upload as IMG_4821.pdf — the SDK reads File.name unless given a descriptor.
    expect(enqueue.mock.calls[0][0][0].file).toMatchObject({
      fileName: 'Floor plan.pdf',
      contentType: 'application/pdf',
    })
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
