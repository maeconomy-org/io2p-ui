import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { Predicate, UUID } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'

export interface BulkObject {
  uuid: string
  name: string
  abbreviation?: string
  version?: string
  description?: string
  isTemplate?: boolean
  softDeleted?: boolean
  [key: string]: unknown
}

export function useBulkActions() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const t = useTranslations()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['objects'] })
    queryClient.invalidateQueries({ queryKey: ['aggregates'] })
    queryClient.invalidateQueries({ queryKey: ['aggregate'] })
    queryClient.invalidateQueries({ queryKey: ['groups'] })
    queryClient.invalidateQueries({ queryKey: ['statements'] })
  }, [queryClient])

  // Bulk soft delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (objects: BulkObject[]) => {
      const results = await Promise.allSettled(
        objects.map((obj) => client.node.softDeleteObject(obj.uuid))
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} of ${objects.length} deletions failed`
        )
      }
      return results
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        t('objects.bulk.bulkDeleteSuccess', { count: variables.length })
      )
    },
    onError: () => {
      invalidateAll()
      toast.error(t('objects.bulk.bulkDeleteFailed'))
    },
  })

  // Bulk revert (restore soft-deleted objects)
  const bulkRevertMutation = useMutation({
    mutationFn: async (objects: BulkObject[]) => {
      const results = await Promise.allSettled(
        objects.map((obj) =>
          client.node.createOrUpdateObject({
            uuid: obj.uuid as UUID,
            name: obj.name,
            abbreviation: obj.abbreviation,
            version: obj.version,
            description: obj.description,
            isTemplate: obj.isTemplate,
          })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${objects.length} restores failed`)
      }
      return results
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        t('objects.bulk.bulkRestoreSuccess', { count: variables.length })
      )
    },
    onError: () => {
      invalidateAll()
      toast.error(t('objects.bulk.bulkRestoreFailed'))
    },
  })

  // Bulk add to group
  const bulkAddToGroupMutation = useMutation({
    mutationFn: async ({
      groupUUID,
      objectUUIDs,
    }: {
      groupUUID: string
      objectUUIDs: string[]
    }) => {
      return client.node.addGroupRecords(groupUUID, {
        recordUUIDs: objectUUIDs as UUID[],
      })
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        t('objects.bulk.addedToGroup', {
          count: variables.objectUUIDs.length,
        })
      )
    },
    onError: () => {
      toast.error(t('objects.bulk.addedToGroupFailed'))
    },
  })

  // Bulk create group + add objects
  const bulkCreateAndAddToGroupMutation = useMutation({
    mutationFn: async ({
      groupName,
      objectUUIDs,
    }: {
      groupName: string
      objectUUIDs: string[]
    }) => {
      const group = await client.node.createGroup({ name: groupName })
      if (group.groupUUID) {
        await client.node.addGroupRecords(group.groupUUID, {
          recordUUIDs: objectUUIDs as UUID[],
        })
      }
      return group
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        t('objects.bulk.addedToGroup', {
          count: variables.objectUUIDs.length,
        })
      )
    },
    onError: () => {
      toast.error(t('objects.bulk.addedToGroupFailed'))
    },
  })

  // Bulk set parent — single batch call with IS_PARENT_OF statements
  const bulkSetParentMutation = useMutation({
    mutationFn: async ({
      parentUUID,
      childUUIDs,
    }: {
      parentUUID: string
      childUUIDs: string[]
    }) => {
      const statements = childUUIDs.map((childUUID) => ({
        subject: parentUUID as UUID,
        predicate: 'IS_PARENT_OF' as Predicate,
        object: childUUID as UUID,
      }))
      return client.node.createStatements(statements)
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        t('objects.bulk.parentSet', { count: variables.childUUIDs.length })
      )
    },
    onError: () => {
      toast.error(t('objects.bulk.parentSetFailed'))
    },
  })

  return {
    bulkDeleteMutation,
    bulkRevertMutation,
    bulkAddToGroupMutation,
    bulkCreateAndAddToGroupMutation,
    bulkSetParentMutation,
  }
}
