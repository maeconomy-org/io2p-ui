import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Page } from 'io2p-client'

import { useEntityListActions } from '@/components/entity-list/use-entity-list-actions'

const remove = vi.fn().mockResolvedValue({})
const restore = vi.fn().mockResolvedValue({})
const success = vi.fn()
const failure = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => failure(...args),
  },
}))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

interface Row {
  id: string
  deleted?: boolean
}

const MESSAGES = {
  deleted: 'x.deleted',
  deleteFailed: 'x.deleteFailed',
  restored: 'x.restored',
  restoreFailed: 'x.restoreFailed',
}

const pageOf = (...rows: Row[]) =>
  ({ data: rows, page: { totalElements: rows.length } }) as unknown as Page<Row>

const renderWith = (page?: Page<Row>) =>
  renderHook(() =>
    useEntityListActions<Row>({
      page,
      remove: { mutateAsync: remove, isPending: false },
      restore: { mutateAsync: restore, isPending: false },
      messages: MESSAGES,
      entityName: 'thing',
    })
  )

describe('useEntityListActions', () => {
  beforeEach(() => {
    remove.mockClear()
    restore.mockClear()
    success.mockClear()
    failure.mockClear()
  })

  describe('selection', () => {
    it('resolves ids against the rendered page and ignores strays', () => {
      // Paging away leaves stale keys in TanStack's map; resolving against the CURRENT page is what
      // stops a bulk action touching a row the user can no longer see.
      const { result } = renderWith(pageOf({ id: 'a' }, { id: 'b' }))

      act(() => result.current.setRowSelection({ a: true, gone: true }))

      expect(result.current.selectedRows.map((r) => r.id)).toEqual(['a'])
    })

    it('reports both halves of a mixed selection', () => {
      const { result } = renderWith(
        pageOf({ id: 'a' }, { id: 'b', deleted: true })
      )

      act(() => result.current.setRowSelection({ a: true, b: true }))

      // A selection spanning live and deleted rows has no single verb, so the bar offers both.
      expect(result.current.anyLive).toBe(true)
      expect(result.current.anyDeleted).toBe(true)
      expect(result.current.deletableCount).toBe(1)
    })
  })

  describe('single delete', () => {
    it('does nothing without a target', async () => {
      const { result } = renderWith(pageOf({ id: 'a' }))
      await act(async () => {
        await result.current.confirmDelete()
      })
      expect(remove).not.toHaveBeenCalled()
    })

    it('deletes, toasts and closes', async () => {
      const { result } = renderWith(pageOf({ id: 'a' }))
      act(() => result.current.setToDelete({ id: 'a' }))
      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(remove).toHaveBeenCalledWith({ id: 'a' })
      expect(success).toHaveBeenCalledWith('x.deleted')
      expect(result.current.toDelete).toBeNull()
    })

    it('closes and reports failure when the delete throws', async () => {
      remove.mockRejectedValueOnce(new Error('nope'))
      const { result } = renderWith(pageOf({ id: 'a' }))
      act(() => result.current.setToDelete({ id: 'a' }))
      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(failure).toHaveBeenCalledWith('x.deleteFailed')
      // Leaving the confirm open over a failed delete invites a second identical attempt.
      expect(result.current.toDelete).toBeNull()
    })
  })

  describe('bulk', () => {
    // The split is the point: Delete must skip rows already deleted, and Restore must skip live
    // ones, or a mixed selection sends the server work it has no business doing.
    it('deletes only the live rows of a mixed selection', async () => {
      const { result } = renderWith(
        pageOf({ id: 'a' }, { id: 'b', deleted: true })
      )
      act(() => result.current.setRowSelection({ a: true, b: true }))
      await act(async () => {
        await result.current.runBulk('delete')
      })

      expect(remove).toHaveBeenCalledTimes(1)
      expect(remove).toHaveBeenCalledWith({ id: 'a' })
    })

    it('restores only the deleted rows of a mixed selection', async () => {
      const { result } = renderWith(
        pageOf({ id: 'a' }, { id: 'b', deleted: true })
      )
      act(() => result.current.setRowSelection({ a: true, b: true }))
      await act(async () => {
        await result.current.runBulk('restore')
      })

      expect(restore).toHaveBeenCalledTimes(1)
      expect(restore).toHaveBeenCalledWith({ id: 'b' })
    })

    it('clears the selection and the confirm even when one row fails', async () => {
      remove.mockRejectedValueOnce(new Error('nope'))
      const { result } = renderWith(pageOf({ id: 'a' }, { id: 'b' }))
      act(() => result.current.setRowSelection({ a: true, b: true }))
      act(() => result.current.setConfirmBulk(true))
      await act(async () => {
        await result.current.runBulk('delete')
      })

      // Keeping a half-applied selection would let the user retry the whole batch, re-deleting the
      // rows that already went.
      expect(result.current.selectedRows).toEqual([])
      expect(result.current.confirmBulk).toBe(false)
      expect(failure).toHaveBeenCalledWith('x.deleteFailed')
    })
  })
})
