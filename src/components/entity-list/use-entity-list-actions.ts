'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { RowSelectionState } from '@tanstack/react-table'
import type { Page } from 'io2p-client'

import { logger } from '@/lib/observability/logger'

/** The least a row must be for this hook to act on it. */
interface ListRow {
  id: string
  deleted?: boolean
}

interface Mutation {
  mutateAsync: (vars: { id: string }) => Promise<unknown>
  isPending: boolean
}

/** Toast keys, per entity — the only domain knowledge the hook needs. */
export interface ListActionMessages {
  deleted: string
  deleteFailed: string
  restored: string
  restoreFailed: string
}

interface UseEntityListActionsOptions<T extends ListRow> {
  /** The page on screen. Selection resolves ids against it, so it must be the rendered one. */
  page?: Page<T>
  remove: Mutation
  restore: Mutation
  messages: ListActionMessages
  /** Names the log line when a bulk run fails. */
  entityName: string
  /**
   * Which selected rows this viewer may delete or restore. Library items are shared read-only, so a
   * selection can hold rows whose owner is someone else; without this the bulk bar offers a verb
   * that 403s partway through and leaves the rest of the selection untouched.
   */
  canAct?: (row: T) => boolean
}

/**
 * Delete, restore and their bulk forms, plus the page-size and selection state around them.
 *
 * `/formulas`, `/constants`, `/templates` and `/processes` each held this verbatim — the same four
 * handlers, the same soft-delete/restore split of a mixed selection, the same page-size reset.
 * Only the toast keys and the mutations differed, so those are arguments and the rest is one copy.
 *
 * The mutations arrive as parameters rather than the hook reaching for a domain hook itself: each
 * entity's lives in a different module (`useFormulas`, `useConstants`, `useTemplates`), and a
 * switch over those here would make a generic table utility import every vertical.
 */
export function useEntityListActions<T extends ListRow>({
  page,
  remove,
  restore,
  messages,
  entityName,
  canAct,
}: UseEntityListActionsOptions<T>) {
  const t = useTranslations()

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [toDelete, setToDelete] = useState<T | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  // Resolved against the CURRENT page, so keys left in TanStack's map after paging cannot hand a
  // bulk action a row the user can no longer see.
  const selectedRows = useMemo(
    () => (page?.data ?? []).filter((row) => rowSelection[row.id]),
    [page, rowSelection]
  )
  // The subset the verbs apply to. Selection itself stays whole: the user picked those rows, and
  // silently unpicking them would hide why an action covers fewer than they chose. Sharing is in
  // scope too — a bundle needs `share` on EVERY resource or the node 403s the whole call.
  const actionableRows = useMemo(
    () => (canAct ? selectedRows.filter(canAct) : selectedRows),
    [selectedRows, canAct]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const handleRestore = useCallback(
    async (row: T) => {
      try {
        await restore.mutateAsync({ id: row.id })
        toast.success(t(messages.restored))
      } catch (error) {
        logger.error(`Restore ${entityName} failed`, { err: error })
        toast.error(t(messages.restoreFailed))
      }
    },
    [restore, t, messages, entityName]
  )

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return
    try {
      await remove.mutateAsync({ id: toDelete.id })
      toast.success(t(messages.deleted))
    } catch (error) {
      logger.error(`Delete ${entityName} failed`, { err: error })
      toast.error(t(messages.deleteFailed))
    } finally {
      // `finally`, so a failed delete does not leave the confirm open inviting a second identical
      // attempt with no explanation either time.
      setToDelete(null)
    }
  }, [toDelete, remove, t, messages, entityName])

  /**
   * Sequential — a partial failure should stop rather than leave an unknown subset changed.
   *
   * Each action only touches the rows it can act on: a selection spanning live and deleted rows has
   * no single verb, so Delete skips what is already deleted and Restore skips what is not.
   */
  const runBulk = useCallback(
    async (action: 'delete' | 'restore') => {
      const mutation = action === 'delete' ? remove : restore
      const targets = actionableRows.filter((row) =>
        action === 'delete' ? !row.deleted : row.deleted
      )
      try {
        for (const row of targets) {
          await mutation.mutateAsync({ id: row.id })
        }
        toast.success(
          t(action === 'delete' ? messages.deleted : messages.restored)
        )
      } catch (error) {
        logger.error(`Bulk ${entityName} ${action} failed`, { err: error })
        toast.error(
          t(
            action === 'delete' ? messages.deleteFailed : messages.restoreFailed
          )
        )
      } finally {
        setConfirmBulk(false)
        clearSelection()
      }
    },
    [actionableRows, remove, restore, clearSelection, t, messages, entityName]
  )

  return {
    rowSelection,
    setRowSelection,
    selectedRows,
    actionableRows,
    clearSelection,
    anyDeleted: actionableRows.some((row) => row.deleted),
    anyLive: actionableRows.some((row) => !row.deleted),
    deletableCount: actionableRows.filter((row) => !row.deleted).length,

    toDelete,
    setToDelete,
    confirmDelete,
    handleRestore,

    confirmBulk,
    setConfirmBulk,
    runBulk,

    isBusy: remove.isPending || restore.isPending,
  }
}
