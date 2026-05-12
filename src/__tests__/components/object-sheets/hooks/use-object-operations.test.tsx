import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useObjectOperations } from '@/components/object-sheets/hooks/use-object-operations'

// ─── Mocks ───────────────────────────────────────────

const updateObjectMetadata = vi.fn()
const deleteObject = vi.fn()
const revertObject = vi.fn()
const importSingleObjectMutate = vi.fn()
const importSingleObjectPending = { value: false }
const createStatement = vi.fn()
const enqueue = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn((promise: Promise<any>) => promise),
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks', () => ({
  useImportApi: () => ({
    importSingleObject: {
      mutateAsync: importSingleObjectMutate,
      get isPending() {
        return importSingleObjectPending.value
      },
    },
  }),
  useObjects: () => ({
    useUpdateObjectMetadata: () => ({ mutateAsync: updateObjectMetadata }),
    useDeleteObject: () => ({ mutateAsync: deleteObject }),
    useRevertObject: () => ({ mutateAsync: revertObject, isPending: false }),
  }),
  useStatements: () => ({
    useCreateStatement: () => ({ mutateAsync: createStatement }),
  }),
}))

vi.mock('@/contexts', () => ({
  useOptionalUploadQueue: () => ({ enqueue }),
}))

vi.mock('@/lib', async () => {
  const actual = await vi.importActual<any>('@/lib')
  return {
    ...actual,
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    isForbiddenError: (err: any) => err?.status === 403,
  }
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

describe('useObjectOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setEditedObject + hasMetadataChanged', () => {
    it('initializes editedObject from initialObject when not editing', async () => {
      const { wrapper } = makeWrapper()
      const initial = { uuid: 'o1', name: 'A', abbreviation: 'a', version: 1 }
      const { result } = renderHook(
        () => useObjectOperations({ initialObject: initial, isEditing: false }),
        { wrapper }
      )

      await waitFor(() =>
        expect(result.current.editedObject).toMatchObject({ uuid: 'o1' })
      )
      expect(result.current.hasMetadataChanged).toBe(false)
    })

    it('reports hasMetadataChanged when any tracked field diverges', async () => {
      const { wrapper } = makeWrapper()
      const initial = { uuid: 'o1', name: 'A', abbreviation: 'a', version: 1 }
      const { result } = renderHook(
        () => useObjectOperations({ initialObject: initial, isEditing: false }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.editedObject).toBeTruthy())

      act(() => {
        result.current.setEditedObject({ ...initial, name: 'B' })
      })
      expect(result.current.hasMetadataChanged).toBe(true)
    })
  })

  describe('saveMetadata', () => {
    it('short-circuits when there are no changes', async () => {
      const { wrapper } = makeWrapper()
      const initial = { uuid: 'o1', name: 'A' }
      const { result } = renderHook(
        () => useObjectOperations({ initialObject: initial, isEditing: false }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.editedObject).toBeTruthy())

      await act(async () => {
        await result.current.saveMetadata()
      })
      expect(updateObjectMetadata).not.toHaveBeenCalled()
    })

    it('calls the update mutation and invalidates caches when changed', async () => {
      updateObjectMetadata.mockResolvedValue({ name: 'B' })
      const onRefetch = vi.fn()
      const { wrapper, invalidateSpy } = makeWrapper()
      const initial = { uuid: 'o1', name: 'A' }
      const { result } = renderHook(
        () =>
          useObjectOperations({
            initialObject: initial,
            isEditing: false,
            onRefetch,
          }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.editedObject).toBeTruthy())

      act(() => {
        result.current.setEditedObject({ ...initial, name: 'B' })
      })
      await act(async () => {
        await result.current.saveMetadata()
      })

      expect(updateObjectMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'o1', name: 'B' })
      )
      expect(invalidateSpy).toHaveBeenCalled()
      expect(onRefetch).toHaveBeenCalled()
    })

    it('throws when editedObject or initialObject is missing', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )
      await expect(result.current.saveMetadata()).rejects.toThrow(
        /Missing required data/
      )
    })
  })

  describe('deleteObject', () => {
    it('throws when no id is supplied', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )
      await expect(result.current.deleteObject('')).rejects.toThrow(
        /Object ID is required/
      )
    })

    it('delegates to the delete mutation', async () => {
      deleteObject.mockResolvedValue(undefined)
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )
      await act(async () => {
        await result.current.deleteObject('o1')
      })
      expect(deleteObject).toHaveBeenCalledWith('o1')
    })
  })

  describe('revertObject', () => {
    it('throws when object has no uuid', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )
      await expect(result.current.revertObject({})).rejects.toThrow(
        /UUID is required/
      )
    })

    it('calls revert with template flag merged in', async () => {
      revertObject.mockResolvedValue(undefined)
      const onRefetch = vi.fn()
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () =>
          useObjectOperations({
            isEditing: false,
            isTemplate: true,
            onRefetch,
          }),
        { wrapper }
      )
      await act(async () => {
        await result.current.revertObject({ uuid: 'o1', name: 'A' })
      })
      expect(revertObject).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'o1', isTemplate: true })
      )
      expect(onRefetch).toHaveBeenCalled()
    })
  })

  describe('createObject', () => {
    it('imports, creates parent relationships, and returns true on success', async () => {
      importSingleObjectMutate.mockResolvedValue({ uuid: 'new-1' })
      createStatement.mockResolvedValue(undefined)
      const onRefetch = vi.fn()
      const { wrapper, invalidateSpy } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false, onRefetch }),
        { wrapper }
      )

      let ok = false
      let createdUuid: string | undefined
      await act(async () => {
        const res = await result.current.createObject({
          name: 'X',
          parents: ['p1'],
          properties: [],
          files: [],
        })
        ok = res.success
        createdUuid = res.uuid
      })

      expect(ok).toBe(true)
      expect(createdUuid).toBe('new-1')
      expect(importSingleObjectMutate).toHaveBeenCalled()
      // One IS_PARENT_OF + one IS_CHILD_OF per parent
      expect(createStatement).toHaveBeenCalledTimes(2)
      expect(invalidateSpy).toHaveBeenCalled()
      expect(onRefetch).toHaveBeenCalled()
    })

    it('returns success=false and does not throw on import failure', async () => {
      importSingleObjectMutate.mockRejectedValue(new Error('api down'))
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )

      let ok = true
      await act(async () => {
        const res = await result.current.createObject({
          name: 'X',
          properties: [],
          files: [],
        })
        ok = res.success
      })
      expect(ok).toBe(false)
    })

    it('enqueues upload tasks when files are present', async () => {
      importSingleObjectMutate.mockResolvedValue({ uuid: 'new-1' })
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useObjectOperations({ isEditing: false }),
        { wrapper }
      )

      await act(async () => {
        await result.current.createObject({
          name: 'X',
          properties: [],
          files: [
            {
              mode: 'upload',
              context: 'object',
              fileName: 'a.pdf',
              file: new Blob(['hi']),
            },
          ],
        })
      })
      expect(enqueue).toHaveBeenCalled()
    })
  })
})
