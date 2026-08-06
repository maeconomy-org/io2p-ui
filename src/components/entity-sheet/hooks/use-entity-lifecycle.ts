'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

/** The slice of a React Query mutation this hook drives — kept structural so any resource fits. */
interface LifecycleMutation {
  mutateAsync: (variables: { id: string }) => Promise<unknown>
  isPending: boolean
}

interface LifecycleResource {
  useRemove: () => LifecycleMutation
  useRestore: () => LifecycleMutation
}

/**
 * Soft-delete and restore for an entity sheet.
 *
 * Both are the same shape — one mutation, one id, drop out of edit mode on success — so they share a
 * runner. A failure toasts and leaves the sheet exactly as it was: unlike a save there is no draft to
 * preserve, but silently returning to view mode would read as "it worked".
 *
 * @param label  entity name for the log line, e.g. `'Object'`
 * @param onDone runs only after the mutation resolves
 */
export function useEntityLifecycle(
  resource: LifecycleResource,
  label: string,
  onDone?: () => void
) {
  const t = useTranslations()
  const removeMutation = resource.useRemove()
  const restoreMutation = resource.useRestore()

  const run = async (action: 'delete' | 'restore', id: string) => {
    try {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      await mutation.mutateAsync({ id })
      onDone?.()
    } catch (error) {
      logger.error(`${label} ${action} failed`, {
        entityId: id,
        status: iomStatus(error),
        err: error,
      })
      toast.error(t(saveErrorMessage(error).key))
    }
  }

  return {
    run,
    isBusy: removeMutation.isPending || restoreMutation.isPending,
  }
}
