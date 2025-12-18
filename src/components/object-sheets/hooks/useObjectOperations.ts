import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { useIomSdkClient } from '@/contexts'
import { getUploadService, logger } from '@/lib'
import { useImportApi, useObjects, useStatements } from '@/hooks'
import {
  transformToImportFormat,
  mapFileContexts,
  getCreatedObjectUuid,
  createParentRelationships,
} from '../utils'

export interface UseObjectOperationsProps {
  initialObject?: any
  isEditing: boolean
  isTemplate?: boolean
  onRefetch?: () => void
}

export interface UseObjectOperationsReturn {
  editedObject: any | null
  setEditedObject: (object: any) => void
  saveMetadata: () => Promise<void>
  deleteObject: (objectId: string) => Promise<void>
  revertObject: (object: any) => Promise<void>
  createObject: (object: any) => Promise<boolean>
  hasMetadataChanged: boolean
  isCreating: boolean
  isReverting: boolean
}

/**
 * Hook for managing object metadata operations (CRUD)
 */
export function useObjectOperations({
  initialObject,
  isEditing,
  isTemplate = false,
  onRefetch,
}: UseObjectOperationsProps): UseObjectOperationsReturn {
  const [editedObject, setEditedObject] = useState<any>(null)

  // Get the specialized metadata update mutation
  const { useUpdateObjectMetadata, useDeleteObject, useRevertObject } =
    useObjects()
  const updateObjectMetadataMutation = useUpdateObjectMetadata()
  const deleteObjectMutation = useDeleteObject()
  const revertObjectMutation = useRevertObject()

  // Get the import API hook (faster approach)
  const { importSingleObject } = useImportApi()

  // Get the statements API for parent relationships
  const { useCreateStatement } = useStatements()
  const createStatementMutation = useCreateStatement()

  // Get query client for manual invalidation
  const queryClient = useQueryClient()

  const client = useIomSdkClient()

  useEffect(() => {
    if (initialObject && !isEditing) {
      setEditedObject({ ...initialObject })
    }
  }, [initialObject, isEditing])

  // Check if metadata has changed
  const hasMetadataChanged =
    editedObject &&
    initialObject &&
    (editedObject.name !== initialObject.name ||
      editedObject.abbreviation !== initialObject.abbreviation ||
      editedObject.version !== initialObject.version ||
      editedObject.description !== initialObject.description)

  const saveMetadata = async (): Promise<void> => {
    if (!editedObject || !initialObject) {
      throw new Error('Missing required data for metadata update')
    }

    if (!hasMetadataChanged) {
      // No changes to save
      return
    }

    try {
      // Call the API to update metadata
      const updatedObject = await updateObjectMetadataMutation.mutateAsync({
        uuid: initialObject.uuid,
        name: editedObject.name,
        abbreviation: editedObject.abbreviation,
        version: editedObject.version,
        description: editedObject.description,
      })

      // Reset the editing state to reflect the updated data
      if (updatedObject) {
        setEditedObject({
          ...initialObject,
          name: updatedObject.name || editedObject.name,
          abbreviation: updatedObject.abbreviation || editedObject.abbreviation,
          version: updatedObject.version || editedObject.version,
          description: updatedObject.description || editedObject.description,
        })
      }

      toast.success('Object metadata updated successfully')

      // Manually trigger a refetch to ensure UI updates immediately
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      logger.error('Error saving metadata:', error)
      toast.error('Failed to update object metadata')
      throw error
    }
  }

  const deleteObject = async (objectId: string): Promise<void> => {
    if (!objectId) {
      throw new Error('Object ID is required for deletion')
    }

    try {
      await toast.promise(deleteObjectMutation.mutateAsync(objectId), {
        loading: 'Deleting object...',
        success: 'Object deleted successfully',
        error: 'Failed to delete object',
      })
    } catch (error) {
      logger.error('Error deleting object:', error)
      throw error
    }
  }

  const revertObject = async (object: any): Promise<void> => {
    if (!object || !object.uuid) {
      throw new Error('Object with UUID is required for revert')
    }

    try {
      toast.loading(
        isTemplate ? 'Reverting template...' : 'Reverting object...',
        { id: 'revert-object' }
      )

      const result = await revertObjectMutation.mutateAsync({
        uuid: object.uuid,
        name: object.name,
        abbreviation: object.abbreviation,
        version: object.version,
        description: object.description,
        isTemplate: object.isTemplate || isTemplate, // Use object's isTemplate or hook's isTemplate flag
      })

      toast.success(
        isTemplate
          ? 'Template restored successfully'
          : 'Object restored successfully',
        { id: 'revert-object' }
      )

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      logger.error('Error reverting object:', error)
      toast.error(
        isTemplate ? 'Failed to restore template' : 'Failed to restore object',
        { id: 'revert-object' }
      )
      throw error
    }
  }

  const createObject = async (object: any): Promise<boolean> => {
    try {
      // Step 1: Immediate UI feedback and optimistic update
      toast.loading('Creating object...', { id: 'save-object' })

      // Step 2: Separate files from object data
      const { uploadFiles, importData } = transformToImportFormat(
        object,
        isTemplate
      )

      // Step 3: Create object via new Aggregate API
      const importResult = await importSingleObject.mutateAsync(importData)

      // Step 3.5: Handle parent relationships if any (BEFORE showing success)
      const createdObjectUuid = getCreatedObjectUuid(importResult)
      if (object.parents && object.parents.length > 0 && createdObjectUuid) {
        try {
          await createParentRelationships(
            object.parents,
            createdObjectUuid,
            createStatementMutation
          )
        } catch (error) {
          logger.error('Error creating parent relationships:', error)
        }
      }

      // Step 4: Show success only after everything is complete
      toast.success('Object created successfully!', {
        id: 'save-object',
        description:
          uploadFiles.length > 0
            ? `${uploadFiles.length} files uploading in background`
            : undefined,
      })

      // Step 5: Upload files in background if any (don't await - let it run in background)
      if (uploadFiles.length > 0) {
        const uploadService = getUploadService(client)

        // Map files to their correct context UUIDs from Aggregate API response
        const fileContexts = mapFileContexts(uploadFiles, importResult)

        if (fileContexts.length > 0) {
          // Start upload in background and handle results
          uploadService.queueFileUploadsWithContext(fileContexts).then(() => {
            // Wait a bit for uploads to complete, then show summary
            setTimeout(async () => {
              const summary = uploadService.getUploadSummary()
              if (summary.completed.length > 0) {
                toast.success(
                  `${summary.completed.length} files uploaded successfully`
                )
              }
              if (summary.failed.length > 0) {
                toast.error(`${summary.failed.length} files failed to upload`)
              }
              uploadService.clearCompleted()
            }, 2000)
          })
        } else {
          console.warn(
            'No file contexts could be mapped from Aggregate API response'
          )
        }
      }

      // Manually invalidate queries after everything is complete (object + relationships)
      // This ensures the object appears in the correct location immediately
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      queryClient.invalidateQueries({ queryKey: ['statements'] })

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }

      return true
    } catch (error: any) {
      logger.error('Error creating object:', error)
      toast.error('Failed to create object', {
        id: 'save-object',
        description: error.message,
      })
      return false
    }
  }

  return {
    editedObject,
    setEditedObject,
    saveMetadata,
    deleteObject,
    revertObject,
    createObject,
    hasMetadataChanged,
    isCreating: importSingleObject.isPending,
    isReverting: revertObjectMutation.isPending,
  }
}
