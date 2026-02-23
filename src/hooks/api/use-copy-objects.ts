import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Predicate } from 'iom-sdk'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { useIomSdkClient } from '@/contexts'
import type { ImportObjectData } from './use-import-api'

export interface CopyObjectsParams {
  sourceUuids: string[]
  targetParentUuids: string[]
  namePrefix: string
  includeChildren: boolean
  copyProperties: boolean
  copyFiles: boolean
  copyAddress: boolean
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Maps an aggregate entity to ImportObjectData for createAggregates.
 * NOTE: parents and files are NOT included — they require separate API calls.
 */
export function mapAggregateToImportData(
  aggregate: any,
  options: {
    namePrefix: string
    copyProperties: boolean
    copyAddress: boolean
  }
): ImportObjectData {
  const originalName = aggregate.name || ''
  const name = options.namePrefix
    ? `${options.namePrefix} ${originalName}`
    : originalName

  const importData: ImportObjectData = {
    name,
    abbreviation: aggregate.abbreviation || undefined,
    version: aggregate.version || undefined,
    description: aggregate.description || undefined,
  }

  // Copy properties (without file attachments — those need separate calls)
  if (options.copyProperties && aggregate.properties?.length > 0) {
    importData.properties = aggregate.properties
      .filter((prop: any) => !prop.softDeleted)
      .map((prop: any) => ({
        key: prop.key,
        label: prop.label || prop.key,
        type: prop.type || 'string',
        values:
          prop.values?.map((val: any) => ({
            value: val.value || '',
            valueTypeCast: val.valueTypeCast || 'string',
            sourceType: val.sourceType,
            files: [],
          })) || [],
        files: [],
      }))
  }

  // Copy address
  if (options.copyAddress && aggregate.address) {
    const addr = aggregate.address
    importData.address = {
      fullAddress: addr.fullAddress || '',
      street: addr.street || '',
      houseNumber: addr.houseNumber || '',
      city: addr.city || '',
      postalCode: addr.postalCode || '',
      country: addr.country || '',
      state: addr.state || undefined,
      district: addr.district || undefined,
    }
  }

  return importData
}

/**
 * Creates bidirectional parent-child statements between two objects.
 */
export async function createParentChildStatements(
  client: any,
  parentUuid: string,
  childUuid: string
): Promise<void> {
  await client.node.createStatement({
    subject: parentUuid,
    predicate: Predicate.IS_PARENT_OF,
    object: childUuid,
  })
  await client.node.createStatement({
    subject: childUuid,
    predicate: Predicate.IS_CHILD_OF,
    object: parentUuid,
  })
}

/**
 * Copies file references from a source object to a target object.
 * Uses uploadFileByReference for each file (creates file record + statement).
 */
export async function copyFileReferences(
  client: any,
  sourceAggregate: any,
  targetObjectUuid: string
): Promise<void> {
  const files = (sourceAggregate.files || []).filter((f: any) => !f.softDeleted)

  for (const file of files) {
    if (!file.fileReference) continue
    try {
      await client.node.uploadFileByReference({
        fileReference: file.fileReference,
        uuidToAttach: targetObjectUuid,
        fileName: file.fileName,
        label: file.label,
        contentType: file.contentType,
        size: file.size,
      })
    } catch (error) {
      logger.warn(
        `Failed to copy file "${file.fileName}" to ${targetObjectUuid}:`,
        error
      )
    }
  }
}

/**
 * Recursively fetches children of a parent.
 * Returns a flat list with each child's original aggregate data.
 */
export async function fetchDescendants(
  client: any,
  parentUuid: string
): Promise<any[]> {
  const results: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const response = await client.node.searchAggregates({
      readDefaultGroup: true,
      parentUUID: parentUuid,
      hasParentUUIDFilter: true,
      page,
      size: 50,
      searchBy: { softDeleted: false },
    })

    const children = response?.content || []

    for (const child of children) {
      results.push(child)

      if (child.children && child.children.length > 0) {
        const grandchildren = await fetchDescendants(client, child.uuid)
        results.push(...grandchildren)
      }
    }

    hasMore = !response?.last
    page++
  }

  return results
}

// ─── hook ───────────────────────────────────────────────────────────────────

/**
 * Hook for copying objects.
 *
 * Flow per source object:
 * 1. Fetch full aggregate data via searchAggregates
 * 2. Create a bare copy via createAggregates (no parents/files)
 * 3. Create parent-child statements to assign the copy to target parents
 * 4. Copy file references via uploadFileByReference (if enabled)
 * 5. If includeChildren: recursively copy subtree with remapped parents
 */
export function useCopyObjects() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const t = useTranslations()

  const mutation = useMutation({
    mutationFn: async (params: CopyObjectsParams) => {
      const {
        sourceUuids,
        targetParentUuids,
        namePrefix,
        includeChildren,
        copyProperties,
        copyFiles,
        copyAddress,
      } = params

      const mapOptions = { namePrefix, copyProperties, copyAddress }
      const createdObjects: any[] = []

      for (const sourceUuid of sourceUuids) {
        // 1. Fetch the full aggregate for this source
        const response = await client.node.searchAggregates({
          readDefaultGroup: true,
          searchBy: { uuid: sourceUuid },
          page: 0,
          size: 1,
        })

        const sourceAggregate = response?.content?.[0]
        if (!sourceAggregate) {
          logger.warn(`Source object ${sourceUuid} not found, skipping`)
          continue
        }

        // 2. Create the copy (no parents/files in payload)
        const importData = mapAggregateToImportData(sourceAggregate, mapOptions)
        const createResult = await client.node.createAggregates([importData])
        const createdObject = createResult?.[0] || createResult
        const newUuid = createdObject?.uuid
        createdObjects.push(createdObject)

        if (!newUuid) {
          logger.warn(
            'Created object has no UUID, skipping post-creation steps'
          )
          continue
        }

        // 3. Create parent-child statements
        for (const parentUuid of targetParentUuids) {
          await createParentChildStatements(client, parentUuid, newUuid)
        }

        // 4. Copy file references
        if (copyFiles) {
          await copyFileReferences(client, sourceAggregate, newUuid)
        }

        // 5. Recursively copy children
        if (
          includeChildren &&
          sourceAggregate.children &&
          sourceAggregate.children.length > 0
        ) {
          const uuidMap = new Map<string, string>()
          uuidMap.set(sourceUuid, newUuid)

          const descendants = await fetchDescendants(client, sourceUuid)

          for (const descendant of descendants) {
            // Create the child copy
            const childImport = mapAggregateToImportData(descendant, mapOptions)
            const childResult = await client.node.createAggregates([
              childImport,
            ])
            const createdChild = childResult?.[0] || childResult
            const childNewUuid = createdChild?.uuid

            if (!childNewUuid) continue

            uuidMap.set(descendant.uuid, childNewUuid)

            // Resolve parent: map original parents to new UUIDs
            const originalParents: string[] = descendant.parents || []
            const mappedParents = originalParents
              .map((p: string) => uuidMap.get(p))
              .filter(Boolean) as string[]

            // Fallback: if no mapped parent found, use the new root
            const effectiveParents =
              mappedParents.length > 0 ? mappedParents : [newUuid]

            for (const parentId of effectiveParents) {
              await createParentChildStatements(client, parentId, childNewUuid)
            }

            // Copy files for child
            if (copyFiles) {
              await copyFileReferences(client, descendant, childNewUuid)
            }

            createdObjects.push(createdChild)
          }
        }
      }

      return createdObjects
    },
    onSuccess: (data) => {
      toast.success(t('objects.duplicate.success'))
      queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      queryClient.invalidateQueries({ queryKey: ['aggregate'] })
      queryClient.invalidateQueries({ queryKey: ['statements'] })
      logger.info(`Successfully copied ${data.length} object(s)`)
    },
    onError: (error) => {
      logger.error('Copy objects failed:', error)
      toast.error(t('objects.duplicate.failed'))
    },
  })

  return {
    copyObjects: mutation.mutateAsync,
    isCopying: mutation.isPending,
    error: mutation.error,
  }
}
