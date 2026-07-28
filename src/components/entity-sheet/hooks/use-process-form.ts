'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ProcessDTO } from 'io2p-client'

import { useProcesses } from '@/hooks/api/entities'
import { useOptionalUploadQueue } from '@/contexts/upload-queue-context'
import { useIomClient } from '@/lib/io2p'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'
import {
  type EntityDraft,
  findEmptyPropertyKey,
  hasPendingUploads,
  uploadTasksFrom,
} from '@/lib/entity-body'
import {
  EMPTY_PROCESS_DRAFT,
  processToDraft,
  buildCreateProcessInput,
  buildUpdateProcessBody,
  findFlowWithoutRef,
  resolveProcessUploadTargets,
} from '@/lib/process-body'

export interface UseProcessFormOptions {
  onSaved?: (id: string) => void
}

/**
 * The process counterpart of `useEntityForm`. Processes diff exactly like objects, so this is the
 * same contract — load into a draft, build one write body, no-op when nothing changed — over the
 * process resource and its two extra flow bags.
 *
 * Two validations run before the write, both because the node would otherwise reject the whole save
 * with an error the user cannot map back to a row: a flow with no target, and the node's rule that a
 * process needs at least one input AND one output.
 */
export function useProcessForm(
  process?: ProcessDTO | null,
  options: UseProcessFormOptions = {}
) {
  const { onSaved } = options
  const t = useTranslations()
  const client = useIomClient()
  const uploadQueue = useOptionalUploadQueue()

  const form = useForm<EntityDraft>({
    defaultValues: process ? processToDraft(process) : EMPTY_PROCESS_DRAFT,
  })

  const { useCreate, useUpdate } = useProcesses()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  const loadedKey = process ? `${process.id}:${process.currentVersion}` : 'new'
  useEffect(() => {
    form.reset(process ? processToDraft(process) : EMPTY_PROCESS_DRAFT)
  }, [loadedKey])

  const submit = form.handleSubmit(async (draft) => {
    const nameless = findEmptyPropertyKey(draft)
    if (nameless >= 0) {
      form.setError(`properties.${nameless}.key`, { type: 'required' })
      toast.error(t('objects.saveError.propertyKeyRequired'))
      return
    }

    const flowWithoutRef = findFlowWithoutRef(draft)
    if (flowWithoutRef) {
      form.setError(`${flowWithoutRef.bag}.${flowWithoutRef.index}.ref`, {
        type: 'required',
      })
      toast.error(t('processes.saveError.flowNeedsObject'))
      return
    }

    // The node enforces this too, but a 422 on save is a poor way to learn it — the user would have
    // to guess which bag was empty.
    if (!(draft.inputs ?? []).length || !(draft.outputs ?? []).length) {
      toast.error(t('processes.saveError.needsInputAndOutput'))
      return
    }

    let committed: ProcessDTO
    try {
      if (process) {
        const body = buildUpdateProcessBody(process, draft)
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({
            id: process.id,
            body,
            options: { ifMatch: process.currentVersion },
          })
        }
        committed = hasPendingUploads(draft)
          ? await client.processes.get(process.id)
          : process
      } else {
        const res = await createMutation.mutateAsync({
          body: buildCreateProcessInput(draft),
        })
        committed = res as unknown as ProcessDTO
      }
    } catch (err) {
      // Nothing was committed, so the draft is left exactly as the user had it — no reset, no
      // onSaved, and no invalidation (which on a 412 would pull server truth over their edits).
      logger.error('Process save failed', {
        processId: process?.id,
        status: iomStatus(err),
        error: err instanceof Error ? err.message : String(err),
      })
      const message = saveErrorMessage(err)
      toast.error(t(message.key, message.values))
      form.setError('root.save', { type: 'server', message: message.key })
      return
    }

    // Flow-scoped, so a file picked inside an input attaches to THAT flow rather than to the
    // process — io2p narrows the target with `flow: {direction, flowId}`.
    const tasks = uploadTasksFrom(resolveProcessUploadTargets(committed, draft))
    if (tasks.length > 0) uploadQueue?.enqueue(tasks)

    form.reset(form.getValues())
    onSaved?.(committed.id)
  })

  return {
    form,
    submit,
    isEditing: !!process,
    isSubmitting: form.formState.isSubmitting,
  }
}
