'use client'

import { useMemo, useCallback } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'

import { isObjectDeleted } from '@/lib'
import { useBulkActions } from '@/hooks'

interface UseBulkSelectionOptions {
  data: any[]
  rowSelection: RowSelectionState
  setRowSelection: (selection: RowSelectionState) => void
}

interface UseBulkSelectionReturn {
  selectedObjects: any[]
  selectedCount: number
  allSelectedDeleted: boolean
  hasNonDeletedSelected: boolean
  clearSelection: () => void
  handlers: {
    handleBulkDelete: () => void
    handleBulkRestore: () => void
    handleAddToGroup: (groupUUID: string) => void
    handleCreateAndAddToGroup: (name: string) => void
    handleSetParent: (parentUUID: string) => void
  }
  mutations: {
    isDeleting: boolean
    isRestoring: boolean
    isAddingToGroup: boolean
    isSettingParent: boolean
  }
}

/**
 * Hook that consolidates bulk selection logic for object tables.
 * Provides selected objects derivation, status flags, handlers, and mutation states.
 */
export function useBulkSelection({
  data,
  rowSelection,
  setRowSelection,
}: UseBulkSelectionOptions): UseBulkSelectionReturn {
  // Get bulk action mutations
  const {
    bulkDeleteMutation,
    bulkRevertMutation,
    bulkAddToGroupMutation,
    bulkCreateAndAddToGroupMutation,
    bulkSetParentMutation,
  } = useBulkActions()

  // Derive selected objects from data based on rowSelection
  const selectedObjects = useMemo(() => {
    return data.filter((obj: any) => obj.uuid && rowSelection[obj.uuid])
  }, [data, rowSelection])

  // Selection status flags
  const selectedCount = Object.keys(rowSelection).length

  const allSelectedDeleted = useMemo(() => {
    return (
      selectedObjects.length > 0 &&
      selectedObjects.every((obj: any) => isObjectDeleted(obj))
    )
  }, [selectedObjects])

  const hasNonDeletedSelected = useMemo(() => {
    return selectedObjects.some((obj: any) => !isObjectDeleted(obj))
  }, [selectedObjects])

  // Clear selection callback
  const clearSelection = useCallback(() => {
    setRowSelection({})
  }, [setRowSelection])

  // Bulk action handlers
  const handleBulkDelete = useCallback(() => {
    const nonDeleted = selectedObjects.filter(
      (obj: any) => !isObjectDeleted(obj)
    )
    if (nonDeleted.length === 0) return
    bulkDeleteMutation.mutate(nonDeleted, { onSuccess: clearSelection })
  }, [selectedObjects, bulkDeleteMutation, clearSelection])

  const handleBulkRestore = useCallback(() => {
    const deleted = selectedObjects.filter((obj: any) => isObjectDeleted(obj))
    if (deleted.length === 0) return
    bulkRevertMutation.mutate(deleted, { onSuccess: clearSelection })
  }, [selectedObjects, bulkRevertMutation, clearSelection])

  const handleAddToGroup = useCallback(
    (groupUUID: string) => {
      const uuids = selectedObjects.map((obj: any) => obj.uuid)
      if (uuids.length === 0) return
      bulkAddToGroupMutation.mutate(
        { groupUUID, objectUUIDs: uuids },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkAddToGroupMutation, clearSelection]
  )

  const handleCreateAndAddToGroup = useCallback(
    (name: string) => {
      const uuids = selectedObjects.map((obj: any) => obj.uuid)
      if (uuids.length === 0) return
      bulkCreateAndAddToGroupMutation.mutate(
        { groupName: name, objectUUIDs: uuids },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkCreateAndAddToGroupMutation, clearSelection]
  )

  const handleSetParent = useCallback(
    (parentUUID: string) => {
      const childUUIDs = selectedObjects.map((obj: any) => obj.uuid)
      if (childUUIDs.length === 0) return
      bulkSetParentMutation.mutate(
        { parentUUID, childUUIDs },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkSetParentMutation, clearSelection]
  )

  return {
    selectedObjects,
    selectedCount,
    allSelectedDeleted,
    hasNonDeletedSelected,
    clearSelection,
    handlers: {
      handleBulkDelete,
      handleBulkRestore,
      handleAddToGroup,
      handleCreateAndAddToGroup,
      handleSetParent,
    },
    mutations: {
      isDeleting: bulkDeleteMutation.isPending,
      isRestoring: bulkRevertMutation.isPending,
      isAddingToGroup:
        bulkAddToGroupMutation.isPending ||
        bulkCreateAndAddToGroupMutation.isPending,
      isSettingParent: bulkSetParentMutation.isPending,
    },
  }
}
