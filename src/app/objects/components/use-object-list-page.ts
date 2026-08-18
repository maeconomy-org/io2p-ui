'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RowSelectionState } from '@tanstack/react-table'
import type { ObjectListItem, Page } from 'io2p-client'

import { canDelete, canReshare, permissionOf } from '@/components/entity-list'
import { useAuth } from '@/contexts'
import { useObjects } from '@/hooks/api/entities'
import { logger } from '@/lib/observability/logger'

import { buildObjectColumns } from './object-columns'
import { useCreateTemplateFromObject } from './use-create-template-from-object'

interface UseObjectListPageOptions {
  /** The page on screen. Selection resolves row ids against it, so it must be the rendered one. */
  page?: Page<ObjectListItem>
  /** Offered as a row action only where single-object sharing exists (the root list). */
  onShare?: (object: ObjectListItem) => void
}

/**
 * Everything `/objects` and `/objects/[uuid]` do identically: page size, the deleted filter, row
 * selection, the six row-action targets, the delete/restore mutations and their bulk forms.
 *
 * The two pages had all of this twice, verbatim, and it had already drifted — the root list's
 * Duplicate action was gated behind a second boolean nothing ever set, so it silently did nothing
 * while the children page's worked. One copy is the fix and the guard against the next one.
 *
 * What is NOT here is what genuinely differs: the root list's scope filter, view toggle and drafts;
 * the children page's parent header and breadcrumb; and both double-click handlers, which navigate
 * differently on purpose.
 */
export function useObjectListPage({ page, onShare }: UseObjectListPageOptions) {
  const t = useTranslations()
  const { userId } = useAuth()

  // Row-action targets. Each is its own state rather than one tagged union because they are
  // independent — a QR modal and a delete confirm can be open over the same row without conflict.
  const [selectedObject, setSelectedObject] = useState<ObjectListItem | null>(
    null
  )
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [qrTarget, setQrTarget] = useState<ObjectListItem | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<ObjectListItem | null>(
    null
  )
  const [objectToDelete, setObjectToDelete] = useState<ObjectListItem | null>(
    null
  )

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkParentOpen, setBulkParentOpen] = useState(false)
  const [shareBundleOpen, setShareBundleOpen] = useState(false)

  const { useRemove, useRestore } = useObjects()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const templateFromObject = useCreateTemplateFromObject()
  const setTemplateSource = templateFromObject.setSource

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  )
  const selectedObjects = useMemo(
    () => (page?.data ?? []).filter((o) => rowSelection[o.id]),
    [page, rowSelection]
  )
  // The rows a lifecycle verb may actually touch. Selection itself stays whole — the user picked
  // those rows — but sending the rest would 403 each one, and Promise.all swallows that into a
  // single logged line the user never sees.
  const deletableObjects = useMemo(
    () => selectedObjects.filter((o) => canDelete(permissionOf(o, userId))),
    [selectedObjects, userId]
  )
  // Its own rung, not `deletableObjects`: a bundle needs `share` on EVERY resource or the node
  // refuses the whole call, and `share` sits below `admin`.
  const shareableObjects = useMemo(
    () => selectedObjects.filter((o) => canReshare(permissionOf(o, userId))),
    [selectedObjects, userId]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const openDetails = useCallback((object: ObjectListItem) => {
    setSelectedObject(object)
    setIsDetailsOpen(true)
  }, [])

  const handleRestore = useCallback(
    async (object: ObjectListItem) => {
      try {
        await restoreMutation.mutateAsync({ id: object.id })
      } catch (error) {
        logger.error('Restore object error:', { err: error })
      }
    },
    [restoreMutation]
  )

  const confirmDelete = useCallback(async () => {
    if (!objectToDelete) return
    try {
      await removeMutation.mutateAsync({ id: objectToDelete.id })
    } catch (error) {
      logger.error('Delete object error:', { err: error })
    } finally {
      setObjectToDelete(null)
    }
  }, [objectToDelete, removeMutation])

  // Sequentially would show the rows vanishing one by one; in parallel the list settles once. A
  // partial failure is logged and the rest still go — the alternative is stopping halfway with no
  // way to tell the user which half.
  const runBulkDelete = useCallback(async () => {
    try {
      await Promise.all(
        deletableObjects
          .filter((o) => !o.deleted)
          .map((o) => removeMutation.mutateAsync({ id: o.id }))
      )
    } catch (error) {
      logger.error('Bulk delete error:', { err: error })
    } finally {
      setConfirmBulkDelete(false)
      clearSelection()
    }
  }, [deletableObjects, removeMutation, clearSelection])

  const runBulkRestore = useCallback(async () => {
    try {
      await Promise.all(
        deletableObjects
          .filter((o) => o.deleted)
          .map((o) => restoreMutation.mutateAsync({ id: o.id }))
      )
    } catch (error) {
      logger.error('Bulk restore error:', { err: error })
    } finally {
      clearSelection()
    }
  }, [deletableObjects, restoreMutation, clearSelection])

  const columns = useMemo(
    () =>
      buildObjectColumns({
        t,
        enableSelection: true,
        isDeleting: removeMutation.isPending,
        isRestoring: restoreMutation.isPending,
        actions: {
          onViewDetails: openDetails,
          onShowQRCode: setQrTarget,
          onDuplicate: setDuplicateTarget,
          onCreateTemplate: setTemplateSource,
          onShare,
          onDelete: setObjectToDelete,
          onRestore: handleRestore,
        },
      }),
    [
      t,
      removeMutation.isPending,
      restoreMutation.isPending,
      openDetails,
      handleRestore,
      setTemplateSource,
      onShare,
    ]
  )

  return {
    columns,
    rowSelection,
    setRowSelection,
    selectedIds,
    selectedObjects,
    // Both verbs are guarded at `admin`, so a selection is actionable only where the viewer holds
    // it — deleted-ness alone would offer the button and 403 on the rows it cannot touch.
    anySelectedDeleted: deletableObjects.some((o) => o.deleted),
    canDeleteSelection: deletableObjects.some((o) => !o.deleted),
    deletableObjects,
    shareableObjects,
    clearSelection,

    isDeleting: removeMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isBusy: removeMutation.isPending || restoreMutation.isPending,

    openDetails,
    handleRestore,
    confirmDelete,
    runBulkDelete,
    runBulkRestore,

    selectedObject,
    isDetailsOpen,
    setIsDetailsOpen,
    qrTarget,
    setQrTarget,
    duplicateTarget,
    setDuplicateTarget,
    objectToDelete,
    setObjectToDelete,
    confirmBulkDelete,
    setConfirmBulkDelete,
    bulkParentOpen,
    setBulkParentOpen,
    shareBundleOpen,
    setShareBundleOpen,

    templateFromObject,
  }
}

export type ObjectListPageState = ReturnType<typeof useObjectListPage>
