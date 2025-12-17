import { Predicate } from 'iom-sdk'
import type { ImportObjectData } from '@/hooks/api/useImportApi'
import { logger } from '@/lib'
import type { Attachment } from '@/types'

/**
 * Transform form object to import API format and separate upload files
 */
export function transformToImportFormat(
  object: any,
  isTemplate: boolean = false
): {
  importData: ImportObjectData
  uploadFiles: Attachment[]
} {
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
    isTemplate: isTemplate, // Add isTemplate flag
    ...(object.address && object.address.fullAddress && !isTemplate // Don't include address for templates
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
    parents: isTemplate ? [] : object.parents, // Templates don't have parents
    files: isTemplate ? [] : objectFiles, // Templates don't have files at object level
    properties,
  }

  return { importData, uploadFiles }
}

/**
 * Map upload files to their correct context UUIDs from Aggregate API response
 */
export function mapFileContexts(
  uploadFiles: Attachment[],
  aggregateResult: any
): Array<{
  attachment: Attachment
  objectUuid?: string
  propertyUuid?: string
  valueUuid?: string
}> {
  const fileContexts: Array<{
    attachment: Attachment
    objectUuid?: string
    propertyUuid?: string
    valueUuid?: string
  }> = []

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

  logger.info('File mapping completed:', {
    total: fileContexts.length,
    object: fileContexts.filter((f) => f.attachment.context === 'object')
      .length,
    property: fileContexts.filter((f) => f.attachment.context === 'property')
      .length,
    value: fileContexts.filter((f) => f.attachment.context === 'value').length,
  })

  return fileContexts
}

/**
 * Get property by index in aggregate result (more reliable than key lookup for duplicates)
 */
export function getPropertyByIndex(
  aggregateResult: any,
  propertyIndex: number
): any {
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
export function getCreatedObjectUuid(importResult: any): string | null {
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
export async function createParentRelationships(
  parentUuids: string[],
  childUuid: string,
  createStatementMutation: any
): Promise<void> {
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
  }
}
