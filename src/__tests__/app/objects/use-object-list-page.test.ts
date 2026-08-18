import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ObjectListItem, Page } from 'io2p-client'

import { useObjectListPage } from '@/app/objects/components/use-object-list-page'

const remove = vi.fn().mockResolvedValue({})
const restore = vi.fn().mockResolvedValue({})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({
    useRemove: () => ({ mutateAsync: remove, isPending: false }),
    useRestore: () => ({ mutateAsync: restore, isPending: false }),
  }),
}))

// The template flow has its own tests; here it only has to exist so the hook can hold its state.
vi.mock('@/app/objects/components/use-create-template-from-object', () => ({
  useCreateTemplateFromObject: () => ({
    source: null,
    setSource: vi.fn(),
    initialData: { name: '', description: '', version: '1.0' },
    confirm: vi.fn(),
    isCreating: false,
  }),
}))

vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

const row = (id: string, deleted = false) =>
  ({ id, name: `Object ${id}`, deleted }) as unknown as ObjectListItem

const pageOf = (...rows: ObjectListItem[]) =>
  ({
    data: rows,
    page: { totalElements: rows.length },
  }) as unknown as Page<ObjectListItem>

describe('useObjectListPage', () => {
  beforeEach(() => {
    remove.mockClear()
    restore.mockClear()
  })

  const renderWith = (page?: Page<ObjectListItem>) =>
    renderHook(() => useObjectListPage({ page }))

  describe('selection', () => {
    it('resolves selected ids against the rendered page', () => {
      const { result } = renderWith(pageOf(row('a'), row('b'), row('c')))

      act(() => result.current.setRowSelection({ a: true, c: true }))

      expect(result.current.selectedIds).toEqual(['a', 'c'])
      expect(
        result.current.selectedObjects.map((o: ObjectListItem) => o.id)
      ).toEqual(['a', 'c'])
    })

    it('ignores ids that are not on this page', () => {
      // Paging away leaves stale keys in TanStack's selection map. Resolving against the CURRENT
      // page is what stops a bulk action touching a row the user can no longer see.
      const { result } = renderWith(pageOf(row('a')))

      act(() => result.current.setRowSelection({ a: true, gone: true }))

      expect(
        result.current.selectedObjects.map((o: ObjectListItem) => o.id)
      ).toEqual(['a'])
    })

    it('reports both halves of a mixed selection', () => {
      const { result } = renderWith(pageOf(row('a'), row('b', true)))

      act(() => result.current.setRowSelection({ a: true, b: true }))

      // A selection spanning live and deleted rows has no single verb, so the bar offers both.
      expect(result.current.canDeleteSelection).toBe(true)
      expect(result.current.anySelectedDeleted).toBe(true)
    })

    it('clears', () => {
      const { result } = renderWith(pageOf(row('a')))
      act(() => result.current.setRowSelection({ a: true }))
      act(() => result.current.clearSelection())
      expect(result.current.selectedIds).toEqual([])
    })
  })

  describe('delete', () => {
    it('does nothing without a target', async () => {
      const { result } = renderWith(pageOf(row('a')))
      await act(async () => {
        await result.current.confirmDelete()
      })
      expect(remove).not.toHaveBeenCalled()
    })

    it('deletes the target and drops it, closing the dialog', async () => {
      const { result } = renderWith(pageOf(row('a')))

      act(() => result.current.setObjectToDelete(row('a')))
      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(remove).toHaveBeenCalledWith({ id: 'a' })
      expect(result.current.objectToDelete).toBeNull()
    })

    it('still closes the dialog when the delete fails', async () => {
      remove.mockRejectedValueOnce(new Error('nope'))
      const { result } = renderWith(pageOf(row('a')))

      act(() => result.current.setObjectToDelete(row('a')))
      await act(async () => {
        await result.current.confirmDelete()
      })

      // The `finally` matters: leaving the confirm open over a failed delete invites a second click
      // that fails the same way, with no explanation either time.
      expect(result.current.objectToDelete).toBeNull()
    })
  })

  describe('bulk', () => {
    it('deletes every selected id and clears', async () => {
      const { result } = renderWith(pageOf(row('a'), row('b')))

      act(() => result.current.setRowSelection({ a: true, b: true }))
      act(() => result.current.setConfirmBulkDelete(true))
      await act(async () => {
        await result.current.runBulkDelete()
      })

      expect(remove).toHaveBeenCalledTimes(2)
      expect(remove).toHaveBeenCalledWith({ id: 'a' })
      expect(remove).toHaveBeenCalledWith({ id: 'b' })
      expect(result.current.confirmBulkDelete).toBe(false)
      expect(result.current.selectedIds).toEqual([])
    })

    it('sends only the rows the viewer may delete, not the whole selection', async () => {
      // The button appears because ONE row is actionable; sending the rest would 403 each of them,
      // and Promise.all turns that into a single logged line the user never sees.
      const { result } = renderWith(
        pageOf(
          { ...row('mine'), permission: 'admin' } as ObjectListItem,
          { ...row('theirs'), permission: 'read' } as ObjectListItem
        )
      )

      act(() => result.current.setRowSelection({ mine: true, theirs: true }))
      await act(async () => {
        await result.current.runBulkDelete()
      })

      expect(remove).toHaveBeenCalledTimes(1)
      expect(remove).toHaveBeenCalledWith({ id: 'mine' })
    })

    it('restores every selected id and clears', async () => {
      const { result } = renderWith(pageOf(row('a', true), row('b', true)))

      act(() => result.current.setRowSelection({ a: true, b: true }))
      await act(async () => {
        await result.current.runBulkRestore()
      })

      expect(restore).toHaveBeenCalledTimes(2)
      expect(result.current.selectedIds).toEqual([])
    })

    it('clears the selection even when one row fails', async () => {
      remove.mockRejectedValueOnce(new Error('nope'))
      const { result } = renderWith(pageOf(row('a'), row('b')))

      act(() => result.current.setRowSelection({ a: true, b: true }))
      await act(async () => {
        await result.current.runBulkDelete()
      })

      // Keeping a half-applied selection would let the user retry the whole batch, re-deleting the
      // rows that already went.
      expect(result.current.selectedIds).toEqual([])
    })
  })

  describe('row targets', () => {
    it('opens details against the clicked row', () => {
      const { result } = renderWith(pageOf(row('a')))

      act(() => result.current.openDetails(row('a')))

      expect(result.current.isDetailsOpen).toBe(true)
      expect(result.current.selectedObject?.id).toBe('a')
    })

    // The regression this guards: /objects gated the Duplicate sheet on a SECOND boolean that
    // nothing ever set, so the row action silently did nothing while the children page worked.
    it('needs only the target to open Duplicate', () => {
      const { result } = renderWith(pageOf(row('a')))

      act(() => result.current.setDuplicateTarget(row('a')))

      expect(result.current.duplicateTarget?.id).toBe('a')
    })
  })
})
