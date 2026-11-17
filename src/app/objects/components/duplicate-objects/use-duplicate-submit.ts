'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  DuplicateIntoOwnSubtreeError,
  DuplicateTooDeepError,
  DuplicateTooLargeError,
  MAX_DUPLICATE_DEPTH,
  MAX_DUPLICATE_OBJECTS,
  useDuplicateObjects,
} from '@/hooks/api/use-duplicate-objects'
import { logger } from '@/lib/observability/logger'

import type { DuplicateObjectsOptions } from './types'

/**
 * The duplicate sheet's confirm. A caller's `onConfirm` replaces the built-in copy, and its
 * `isCopying` replaces the built-in pending state.
 */
export function useDuplicateSubmit({
  onConfirm,
  isCopying: isCopyingProp,
  onDone,
}: {
  onConfirm?: (options: DuplicateObjectsOptions) => Promise<void>
  isCopying?: boolean
  onDone: () => void
}) {
  const t = useTranslations()
  const { duplicateObjects, isDuplicating } = useDuplicateObjects()

  const submit = async (options: DuplicateObjectsOptions) => {
    if (onConfirm) {
      await onConfirm(options)
      return
    }
    const { sourceObjects, targetParentUuids, ...copy } = options
    try {
      await duplicateObjects({
        sourceIds: sourceObjects.map((o) => o.uuid),
        targetParentIds: targetParentUuids,
        ...copy,
      })
      toast.success(
        t('objects.duplicate.copied', { count: sourceObjects.length })
      )
      onDone()
    } catch (error) {
      // The loop is sequential and stops at the first failure, so an unknown
      // number of copies already exist. Saying so beats a silent no-op that
      // looks like the click never registered — the list behind the sheet has
      // already been invalidated and will show them.
      // Both guards run BEFORE any write, so nothing was created and the
      // generic "some may already exist" warning would be wrong here.
      if (error instanceof DuplicateIntoOwnSubtreeError) {
        toast.error(t('objects.duplicate.targetInsideSource'))
        return
      }
      if (error instanceof DuplicateTooLargeError) {
        toast.error(
          t('objects.duplicate.tooLarge', { count: MAX_DUPLICATE_OBJECTS })
        )
        return
      }
      if (error instanceof DuplicateTooDeepError) {
        toast.error(
          t('objects.duplicate.tooDeep', { levels: MAX_DUPLICATE_DEPTH })
        )
        return
      }
      logger.error('Duplicate objects failed', { err: error })
      toast.error(t('objects.duplicate.failedPartial'))
    }
  }

  const isCopying = isCopyingProp ?? isDuplicating

  // The copy runs object by object in this tab, so leaving mid-way keeps the part already made.
  // Only while it runs; an always-on guard trains people to ignore it.
  useEffect(() => {
    if (!isCopying) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome only shows the prompt when this is set
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isCopying])

  return { submit, isCopying }
}
