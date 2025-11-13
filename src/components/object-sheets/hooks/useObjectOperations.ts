import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Predicate } from 'iom-sdk'
import { useQueryClient } from '@tanstack/react-query'

import { getUploadService } from '@/lib/upload-service'
import { useIomSdkClient } from '@/providers/query-provider'
import type { ImportObjectData } from '@/hooks/api/useImportApi'
import { useImportApi, useObjects, useStatements } from '@/hooks'

import type { Attachment } from '@/types'

export interface UseObjectOperationsProps {
  initialObject?: any
  isEditing: boolean
  onRefetch?: () => void
}

export interface UseObjectOperationsReturn {
  editedObject: any | null
  setEditedObject: (object: any) => void
  saveMetadata: () => Promise<void>
  deleteObject: (objectId: string) => Promise<void>
  createObject: (object: any) => Promise<boolean>
  hasMetadataChanged: boolean
  isCreating: boolean
}

/**
 * Hook for managing object metadata operations (CRUD)
 */
export function useObjectOperations({
  initialObject,
  isEditing,
  onRefetch,
}: UseObjectOperationsProps): UseObjectOperationsReturn {
  const [editedObject, setEditedObject] = useState<any>(null)

  // Get the specialized metadata update mutation
  const { useUpdateObjectMetadata, useDeleteObject } = useObjects()
  const updateObjectMetadataMutation = useUpdateObjectMetadata()
  const deleteObjectMutation = useDeleteObject()

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
      console.error('Error saving metadata:', error)
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
      console.error('Error deleting object:', error)
      throw error
    }
  }

  const createObject = async (object: any): Promise<boolean> => {
    try {
      // Step 1: Immediate UI feedback and optimistic update
      toast.loading('Creating object...', { id: 'save-object' })

      // Step 2: Separate files from object data
      const { uploadFiles, importData } = transformToImportFormat(object)

      // Step 3: Create object via new Aggregate API
      const importResult = await importSingleObject.mutateAsync(importData)

      // Step 3.5: Handle parent relationships if any (BEFORE showing success)
      const createdObjectUuid = getCreatedObjectUuid(importResult)
      if (object.parents && object.parents.length > 0 && createdObjectUuid) {
        try {
          await createParentRelationships(object.parents, createdObjectUuid)
        } catch (error) {
          console.error('Error creating parent relationships:', error)
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
      console.error('Error creating object:', error)
      toast.error('Failed to create object', {
        id: 'save-object',
        description: error.message,
      })
      return false
    }
  }

  /**
   * Transform form object to import API format and separate upload files
   */
  const transformToImportFormat = (
    object: any
  ): {
    importData: ImportObjectData
    uploadFiles: Attachment[]
  } => {
    const uploadFiles: Attachment[] = []

    // Transform object-level files
    const objectFiles =
      object.files
        ?.map((file: Attachment) => {
          if (file.mode === 'upload') {
            // Add to upload queue with object context
            uploadFiles.push({ ...file, context: 'object' })
            // Don't include upload files in Aggregate API payload
            return null
          } else {
            // Only reference files go to Aggregate API
            return {
              fileName: file.fileName || file.label || '',
              fileReference: file.url || file.fileReference || '',
              label: file.label,
              contentType: file.mimeType,
              size: file.size,
            }
          }
        })
        .filter(Boolean) || []

    // Transform properties and handle their files
    const properties =
      object.properties?.map((prop: any, propertyIndex: number) => {
        // Handle property-level files
        const propFiles =
          prop.files
            ?.map((file: Attachment) => {
              if (file.mode === 'upload') {
                uploadFiles.push({
                  ...file,
                  context: 'property',
                  propertyKey: prop.key,
                  propertyIndex: propertyIndex,
                })
                return null
              } else {
                // Only reference files go to Aggregate API
                return {
                  fileName: file.fileName,
                  fileReference: file.url || file.fileReference || '',
                  label: file.label,
                  contentType: file.mimeType,
                  size: file.size,
                }
              }
            })
            .filter(Boolean) || []

        // Handle values and their files
        const values =
          prop.values?.map((value: any, valueIndex: number) => {
            const valueFiles =
              value.files
                ?.map((file: Attachment) => {
                  if (file.mode === 'upload') {
                    uploadFiles.push({
                      ...file,
                      context: 'value',
                      propertyKey: prop.key,
                      propertyIndex: propertyIndex,
                      valueIndex: valueIndex,
                    })
                    return null
                  } else {
                    // Only reference files go to Aggregate API
                    return {
                      fileName: file.fileName,
                      fileReference: file.url || file.fileReference || '',
                      label: file.label,
                      contentType: file.mimeType,
                      size: file.size,
                    }
                  }
                })
                .filter(Boolean) || []

            return {
              value: value.value,
              valueTypeCast: value.valueTypeCast || 'string',
              sourceType: value.sourceType || 'manual',
              files: valueFiles,
            }
          }) || []

        return {
          key: prop.key,
          label: prop.label || prop.key,
          type: prop.type || 'string',
          values,
          files: propFiles,
        }
      }) || []

    const importData: ImportObjectData = {
      name: object.name,
      abbreviation: object.abbreviation,
      version: object.version,
      description: object.description,
      ...(object.address && object.address.fullAddress
        ? {
            address: {
              fullAddress: object.address.fullAddress,
              street: object.address.components?.street || '',
              houseNumber: object.address.components?.houseNumber || '',
              city: object.address.components?.city || '',
              postalCode: object.address.components?.postalCode || '',
              country: object.address.components?.country || '',
              state: object.address.components?.state,
              district: object.address.components?.district,
            },
          }
        : {}),
      parents: object.parents,
      files: objectFiles,
      properties,
    }

    return { importData, uploadFiles }
  }

  /**
   * Map upload files to their correct context UUIDs from Aggregate API response
   */
  const mapFileContexts = (
    uploadFiles: Attachment[],
    aggregateResult: any
  ): Array<{
    attachment: Attachment
    objectUuid?: string
    propertyUuid?: string
    valueUuid?: string
  }> => {
    const fileContexts: Array<{
      attachment: Attachment
      objectUuid?: string
      propertyUuid?: string
      valueUuid?: string
    }> = []

    console.log('Mapping file contexts for object creation:', {
      uploadFiles: uploadFiles.length,
    })

    const objectUuid =
      aggregateResult?.uuid ||
      aggregateResult?.objectUuid ||
      aggregateResult?.data?.uuid ||
      aggregateResult?.[0]?.uuid

    for (const file of uploadFiles) {
      const context: {
        attachment: Attachment
        objectUuid?: string
        propertyUuid?: string
        valueUuid?: string
      } = { attachment: file }

      if (file.context === 'object') {
        context.objectUuid = objectUuid
      } else if (
        file.context === 'property' &&
        typeof file.propertyIndex === 'number'
      ) {
        const property = getPropertyByIndex(aggregateResult, file.propertyIndex)
        context.objectUuid = objectUuid
        context.propertyUuid = property?.uuid
      } else if (
        file.context === 'value' &&
        typeof file.propertyIndex === 'number' &&
        typeof file.valueIndex === 'number'
      ) {
        const property = getPropertyByIndex(aggregateResult, file.propertyIndex)
        const value = property?.values?.[file.valueIndex]
        context.objectUuid = objectUuid
        context.propertyUuid = property?.uuid
        context.valueUuid = value?.uuid
      }

      if (context.objectUuid) {
        fileContexts.push(context)
      }
    }

    console.log('File mapping completed:', {
      total: fileContexts.length,
      object: fileContexts.filter((f) => f.attachment.context === 'object')
        .length,
      property: fileContexts.filter((f) => f.attachment.context === 'property')
        .length,
      value: fileContexts.filter((f) => f.attachment.context === 'value')
        .length,
    })

    return fileContexts
  }

  /**
   * Get property by index in aggregate result (more reliable than key lookup for duplicates)
   */
  const getPropertyByIndex = (
    aggregateResult: any,
    propertyIndex: number
  ): any => {
    const properties =
      aggregateResult?.properties || // Direct properties array
      aggregateResult?.data?.properties || // Wrapped in data object
      aggregateResult?.[0]?.properties || // Array response with object at index 0
      aggregateResult?.object?.properties // Object wrapper

    return properties?.[propertyIndex] || null
  }

  /**
   * Extract the created object UUID from the import result
   */
  const getCreatedObjectUuid = (importResult: any): string | null => {
    return (
      importResult?.uuid ||
      importResult?.objectUuid ||
      importResult?.data?.uuid ||
      importResult?.[0]?.uuid ||
      null
    )
  }

  /**
   * Create parent-child relationships using the statement API
   */
  const createParentRelationships = async (
    parentUuids: string[],
    childUuid: string
  ): Promise<void> => {
    console.log('Creating parent relationships:', {
      parents: parentUuids,
      child: childUuid,
    })

    // Create statements for each parent relationship
    for (const parentUuid of parentUuids) {
      // Create IS_PARENT_OF statement (parent -> child)
      await createStatementMutation.mutateAsync({
        subject: parentUuid,
        predicate: Predicate.IS_PARENT_OF,
        object: childUuid,
      })

      // Create IS_CHILD_OF statement (child -> parent)
      await createStatementMutation.mutateAsync({
        subject: childUuid,
        predicate: Predicate.IS_CHILD_OF,
        object: parentUuid,
      })

      console.log(`Created parent relationship: ${parentUuid} -> ${childUuid}`)
    }

    console.log(
      `Successfully created ${parentUuids.length} parent relationships`
    )
  }

  return {
    editedObject,
    setEditedObject,
    saveMetadata,
    deleteObject,
    createObject,
    hasMetadataChanged,
    isCreating: importSingleObject.isPending,
  }
}
