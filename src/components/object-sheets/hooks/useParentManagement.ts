import { useState, useEffect } from 'react'
import { Predicate } from 'iom-sdk'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { useStatements } from '@/hooks/api'
import type { ParentObject } from '@/types'

export interface UseParentManagementProps {
  initialParents?: string[]
  objectUuid?: string
  onRefetch?: () => void
}

export interface UseParentManagementReturn {
  parents: ParentObject[]
  setParents: (parents: ParentObject[]) => void
  addParent: (parentUuid: string) => void
  removeParent: (parentUuid: string) => void
  saveParents: () => Promise<void>
  hasParentsChanged: boolean
  isSaving: boolean
}

/**
 * Hook for managing parent object operations
 */
export function useParentManagement({
  initialParents = [],
  objectUuid,
  onRefetch,
}: UseParentManagementProps): UseParentManagementReturn {
  const [parents, setParents] = useState<ParentObject[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Get the statements mutations
  const { useCreateStatement, useDeleteStatement } = useStatements()
  const createStatementMutation = useCreateStatement()
  const deleteStatementMutation = useDeleteStatement()

  // Initialize parents from initial data
  useEffect(() => {
    if (initialParents) {
      setParents(initialParents.map((uuid) => ({ uuid })))
    }
  }, [objectUuid])

  // Check if parents have changed
  const hasParentsChanged = () => {
    const currentParentUuids = parents.map((p) => p.uuid).sort()
    const initialParentUuids = initialParents.sort()
    return (
      JSON.stringify(currentParentUuids) !== JSON.stringify(initialParentUuids)
    )
  }

  const addParent = (parentUuid: string) => {
    if (!parents.some((p) => p.uuid === parentUuid)) {
      setParents([...parents, { uuid: parentUuid }])
    }
  }

  const removeParent = (parentUuid: string) => {
    setParents(parents.filter((p) => p.uuid !== parentUuid))
  }

  const saveParents = async (): Promise<void> => {
    if (!objectUuid) {
      throw new Error('Object UUID is required to save parents')
    }

    if (!hasParentsChanged()) {
      // No changes to save
      return
    }

    setIsSaving(true)
    try {
      const currentParentUuids = parents.map((p) => p.uuid)
      const initialParentUuids = initialParents

      // Find parents to add (in current but not in initial)
      const parentsToAdd = currentParentUuids.filter(
        (uuid) => !initialParentUuids.includes(uuid)
      )

      // Find parents to remove (in initial but not in current)
      const parentsToRemove = initialParentUuids.filter(
        (uuid) => !currentParentUuids.includes(uuid)
      )

      // Create statements for new parent relationships
      for (const parentUuid of parentsToAdd) {
        // Create IS_PARENT_OF statement (parent -> child)
        await createStatementMutation.mutateAsync({
          subject: parentUuid,
          predicate: Predicate.IS_PARENT_OF,
          object: objectUuid,
        })

        // Create IS_CHILD_OF statement (child -> parent)
        await createStatementMutation.mutateAsync({
          subject: objectUuid,
          predicate: Predicate.IS_CHILD_OF,
          object: parentUuid,
        })
      }

      // Delete statements for removed parent relationships
      for (const parentUuid of parentsToRemove) {
        // Delete IS_PARENT_OF statement (parent -> child)
        await deleteStatementMutation.mutateAsync({
          subject: parentUuid,
          predicate: Predicate.IS_PARENT_OF,
          object: objectUuid,
        })

        // Delete IS_CHILD_OF statement (child -> parent)
        await deleteStatementMutation.mutateAsync({
          subject: objectUuid,
          predicate: Predicate.IS_CHILD_OF,
          object: parentUuid,
        })
      }

      toast.success('Parent objects updated successfully')

      // Manually trigger a refetch to ensure UI updates immediately
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      logger.error('Error saving parents:', error)
      toast.error('Failed to update parent objects')
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  return {
    parents,
    setParents,
    addParent,
    removeParent,
    saveParents,
    hasParentsChanged: hasParentsChanged(),
    isSaving,
  }
}
