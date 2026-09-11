'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ProcessDTO } from 'io2p-client'

import { useProcesses } from '@/hooks/api/entities'
import { useOptionalUploadQueue } from '@/contexts/upload-queue-context'
import { useIomClient } from '@/lib/io2p'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import {
  type EntityDraft,
  findEmptyPropertyKey,
  findEmptyFlowPropertyKey,
  hasPendingUploads,
  uploadTasksFrom,
  EMPTY_PROCESS_DRAFT,
  processToDraft,
  buildCreateProcessInput,
  buildUpdateProcessBody,
  findEmptiedDirection,
  findFlowWithoutRef,
  resolveProcessUploadTargets,
} from '@/lib/entity'

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

  const loadedKey = process ? `${process.id}:${process.currentVersion}` : 'new'

  /**
   * `values`, not a `reset` in an effect — the same ordering `useTemplateForm` documents.
   *
   * The row's Edit action opens the sheet in EDIT mode while the fetch is still in flight, so the
   * Details inputs mount in the very commit the process arrives. A `reset` fired from an effect at
   * that point drops every registered ref (`_fields = {}`), leaving Name blank and Description dead:
   * typing dirtied nothing and Save never enabled. `values` resets with `keepFieldsRef`, so the
   * mounted inputs keep their refs and take the loaded value.
   *
   * MEMOISED on `loadedKey`: `processToDraft` mints a new object every render, and `values` re-syncs
   * whenever the reference changes — unmemoised it would wipe the draft on every keystroke.
   *
   * NO `resetOptions: { keepDirtyValues: true }`. It reads plausible and it silently breaks uploads:
   * a pending pick sits in `files` as a local draft, so on the refetch that follows the upload RHF
   * keeps that draft and drops the server's real file. The row never appears.
   */
  const values = useMemo(
    () => (process ? processToDraft(process) : EMPTY_PROCESS_DRAFT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey]
  )

  const form = useForm<EntityDraft>({
    defaultValues: values,
    values,
  })

  const { useCreate, useUpdate } = useProcesses()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  const submit = form.handleSubmit(async (draft) => {
    // Name lives on the Details tab, and Radix unmounts an inactive tab along with the field's
    // registered rule — saving from any other tab reached the node and came back a 400.
    if (!draft.name.trim()) {
      form.setError(
        'name',
        { type: 'required', message: 'processes.saveError.nameRequired' },
        { shouldFocus: true }
      )
      toast.error(t('processes.saveError.nameRequired'))
      return
    }

    const nameless = findEmptyPropertyKey(draft)
    if (nameless >= 0) {
      form.setError(`properties.${nameless}.key`, {
        type: 'required',
        message: 'objects.saveError.propertyKeyRequired',
      })
      toast.error(t('objects.saveError.propertyKeyRequired'))
      return
    }

    // Flow properties are a second mount of the same fields and the builder drops a
    // blank-key one just the same — without this the value vanishes under a success toast.
    const namelessFlow = findEmptyFlowPropertyKey(draft)
    if (namelessFlow) {
      form.setError(namelessFlow, {
        type: 'required',
        message: 'objects.saveError.propertyKeyRequired',
      })
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

    // Counts LIVE flows, not entries: a bag whose rows are all soft-deleted still has length, and
    // the node 422s on emptying a direction. Naming the side beats making the user guess which.
    const emptied = findEmptiedDirection(draft)
    if (emptied) {
      toast.error(
        t(
          emptied === 'inputs'
            ? 'processes.saveError.needsInput'
            : 'processes.saveError.needsOutput'
        )
      )
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
        err: err,
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
