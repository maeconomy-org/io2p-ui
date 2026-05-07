import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Predicate } from 'iom-sdk'

import { useParentManagement } from '@/components/object-sheets/hooks/use-parent-management'

// ─── Mocks ───────────────────────────────────────────

const createStatement = vi.fn()
const deleteStatement = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/api', () => ({
  useStatements: () => ({
    useCreateStatement: () => ({ mutateAsync: createStatement }),
    useDeleteStatement: () => ({ mutateAsync: deleteStatement }),
  }),
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
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper }
}

describe('useParentManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parents state', () => {
    it('seeds parents from initialParents on mount', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () =>
          useParentManagement({
            initialParents: ['p1', 'p2'],
            objectUuid: 'o1',
          }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(2))
      expect(result.current.parents.map((p) => p.uuid)).toEqual(['p1', 'p2'])
    })

    it('addParent appends; removeParent drops; both no-op on duplicates/missing', () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useParentManagement({ initialParents: ['p1'], objectUuid: 'o1' }),
        { wrapper }
      )

      act(() => result.current.addParent('p2'))
      expect(result.current.parents.map((p) => p.uuid)).toEqual(['p1', 'p2'])

      // Duplicate — should not double-add
      act(() => result.current.addParent('p2'))
      expect(result.current.parents.map((p) => p.uuid)).toEqual(['p1', 'p2'])

      act(() => result.current.removeParent('p1'))
      expect(result.current.parents.map((p) => p.uuid)).toEqual(['p2'])
    })
  })

  describe('hasParentsChanged', () => {
    it('is false when sets match (order-independent)', async () => {
      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        () =>
          useParentManagement({
            initialParents: ['p1', 'p2'],
            objectUuid: 'o1',
          }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(2))

      // Reorder via setParents — should still be "no change" (sort-compared).
      act(() => result.current.setParents([{ uuid: 'p2' }, { uuid: 'p1' }]))
      rerender()
      expect(result.current.hasParentsChanged).toBe(false)
    })

    it('is true after add or remove', async () => {
      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        () => useParentManagement({ initialParents: ['p1'], objectUuid: 'o1' }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(1))

      act(() => result.current.addParent('p2'))
      rerender()
      expect(result.current.hasParentsChanged).toBe(true)
    })
  })

  describe('saveParents', () => {
    it('throws when objectUuid is missing', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useParentManagement({ initialParents: [] }),
        { wrapper }
      )
      await expect(result.current.saveParents()).rejects.toThrow(
        /Object UUID is required/
      )
    })

    it('short-circuits when nothing changed', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useParentManagement({ initialParents: ['p1'], objectUuid: 'o1' }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(1))

      await act(async () => {
        await result.current.saveParents()
      })
      expect(createStatement).not.toHaveBeenCalled()
      expect(deleteStatement).not.toHaveBeenCalled()
    })

    it('creates IS_PARENT_OF + IS_CHILD_OF for each added parent', async () => {
      createStatement.mockResolvedValue(undefined)
      const onRefetch = vi.fn()
      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        () =>
          useParentManagement({
            initialParents: ['p1'],
            objectUuid: 'o1',
            onRefetch,
          }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(1))

      act(() => result.current.addParent('p2'))
      rerender()
      await act(async () => {
        await result.current.saveParents()
      })

      // 2 statements per new parent (IS_PARENT_OF + IS_CHILD_OF), one parent added
      expect(createStatement).toHaveBeenCalledTimes(2)
      expect(createStatement).toHaveBeenCalledWith({
        subject: 'p2',
        predicate: Predicate.IS_PARENT_OF,
        object: 'o1',
      })
      expect(createStatement).toHaveBeenCalledWith({
        subject: 'o1',
        predicate: Predicate.IS_CHILD_OF,
        object: 'p2',
      })
      expect(onRefetch).toHaveBeenCalled()
    })

    it('deletes IS_PARENT_OF + IS_CHILD_OF for each removed parent', async () => {
      deleteStatement.mockResolvedValue(undefined)
      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        () =>
          useParentManagement({
            initialParents: ['p1', 'p2'],
            objectUuid: 'o1',
          }),
        { wrapper }
      )
      await waitFor(() => expect(result.current.parents).toHaveLength(2))

      act(() => result.current.removeParent('p1'))
      rerender()
      await act(async () => {
        await result.current.saveParents()
      })

      expect(deleteStatement).toHaveBeenCalledTimes(2)
      expect(deleteStatement).toHaveBeenCalledWith({
        subject: 'p1',
        predicate: Predicate.IS_PARENT_OF,
        object: 'o1',
      })
      expect(deleteStatement).toHaveBeenCalledWith({
        subject: 'o1',
        predicate: Predicate.IS_CHILD_OF,
        object: 'p1',
      })
    })

    it('rethrows on mutation failure (so the EditableSection can show errors)', async () => {
      createStatement.mockRejectedValue(new Error('api down'))
      const { wrapper } = makeWrapper()
      const { result, rerender } = renderHook(
        () => useParentManagement({ initialParents: [], objectUuid: 'o1' }),
        { wrapper }
      )

      act(() => result.current.addParent('p-new'))
      rerender()
      await act(async () => {
        await expect(result.current.saveParents()).rejects.toThrow('api down')
      })
    })
  })
})
