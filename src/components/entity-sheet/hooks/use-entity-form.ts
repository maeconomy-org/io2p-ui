'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectDTO } from 'io2p-client'

import { useObjects } from '@/hooks/api/entities'
import { useOptionalUploadQueue } from '@/contexts/upload-queue-context'
import { useIomClient } from '@/lib/io2p'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import {
  type EntityDraft,
  dtoToDraft,
  findEmptyPropertyKey,
  hasPendingUploads,
  buildUploadTasks,
  buildCreateObjectInput,
  buildUpdateObjectBody,
} from '@/lib/entity'

const EMPTY_DRAFT: EntityDraft = {
  name: '',
  description: null,
  address: null,
  parentIds: [],
  properties: [],
}

export interface UseEntityFormOptions {
  /** Parents to preset on a create draft (e.g. the "add child" flow). */
  defaultParentIds?: string[]
  /**
   * A locally-stored draft being resumed. Only meaningful when creating. The `id` is carried so the
   * reload effect can tell one draft from another — without it, resuming a second draft while the
   * sheet stays mounted would keep showing the first.
   */
  resumeDraft?: { id: string; draft: EntityDraft } | null
  /** Called after a successful create/update (or a no-op save) with the entity id. */
  /**
   * `addedParents` is empty on create and on any save that did not link a new parent. It exists
   * because `/objects` lists ROOTS: gaining a parent removes the object from the list the user is
   * looking at, and this is the only moment anything can say where it went.
   */
  onSaved?: (id: string, addedParents: string[]) => void
}

/**
 * The one form behind the EntitySheet. Loads an entity into an editable draft (or opens empty for
 * create) and, on submit, diffs it into a single write body. An unchanged edit is a no-op (empty
 * PATCH) — no network call. Shared by objects now; processes/templates reuse the same builders.
 *
 * File uploads attach AFTER the entity write: io2p requires an upload to target an existing entity, so
 * once the object is committed we resolve each pending pick's target and `files.upload(blob, target)`.
 * References author inline in the body. A failed upload does NOT roll back the (already-saved) entity —
 * it toasts; the file simply isn't attached (visible on the next reload as absent).
 *
 * A failed ENTITY WRITE is different: nothing was committed, so the draft is left untouched and dirty
 * for the user to retry or copy out of. The two failures are caught separately on purpose — sharing one
 * handler would skip the post-save reset after a mere upload failure and pretend the save didn't happen.
 */
export function useEntityForm(
  entity?: ObjectDTO | null,
  options: UseEntityFormOptions = {}
) {
  const { defaultParentIds, resumeDraft, onSaved } = options
  const t = useTranslations()
  const client = useIomClient()
  // Optional so the hook still renders outside the provider (tests, isolated usage).
  const uploadQueue = useOptionalUploadQueue()

  // A resumed draft already carries its own parents, so `defaultParentIds` must not overwrite them.
  const blankOrResumed = (): EntityDraft =>
    resumeDraft?.draft ?? { ...EMPTY_DRAFT, parentIds: defaultParentIds ?? [] }

  const initial: EntityDraft = entity ? dtoToDraft(entity) : blankOrResumed()

  const form = useForm<EntityDraft>({ defaultValues: initial })

  const { useCreate, useUpdate } = useObjects()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  // Reload the form whenever a different entity (or a newer version after save) arrives.
  const loadedKey = entity
    ? `${entity.id}:${entity.currentVersion}`
    : `new:${resumeDraft?.id ?? ''}`
  useEffect(() => {
    form.reset(entity ? dtoToDraft(entity) : blankOrResumed())
    // Identity key ONLY. `form` and `entity` are deliberately absent: this effect exists to resync
    // when a DIFFERENT entity or draft arrives, and depending on the objects themselves would reset
    // the form mid-edit on any unrelated re-render, discarding what the user typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey])

  /**
   * Hand pending picks to the background queue, targeted against the committed object.
   *
   * Enqueued, NOT awaited: bytes can take minutes and the user shouldn't be held in a modal for
   * them. Save means "the object is stored"; the files follow, visible in the upload center, and
   * each one refetches the entity as it lands. That does mean Save can succeed while an upload
   * later fails — which is why the queue surfaces per-file status and retry rather than a toast
   * that vanishes.
   */
  const attachUploads = (committed: ObjectDTO, draft: EntityDraft) => {
    const tasks = buildUploadTasks(committed, draft)
    if (tasks.length > 0) uploadQueue?.enqueue(tasks)
  }

  const submit = form.handleSubmit(async (draft) => {
    let committed: ObjectDTO

    // A property with content but no key is dropped by the builders, so saving would silently lose
    // the user's work. Refuse rather than pretend.
    const nameless = findEmptyPropertyKey(draft)
    if (nameless >= 0) {
      form.setError(`properties.${nameless}.key`, {
        type: 'required',
        message: 'objects.saveError.propertyKeyRequired',
      })
      toast.error(t('objects.saveError.propertyKeyRequired'))
      return
    }

    try {
      if (entity) {
        const body = buildUpdateObjectBody(entity, draft)
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({
            id: entity.id,
            body,
            options: { ifMatch: entity.currentVersion },
          })
        }
        // Uploads need the committed tree (new value/property ids) to resolve their targets.
        committed = hasPendingUploads(draft)
          ? await client.objects.get(entity.id)
          : entity
      } else {
        const res = await createMutation.mutateAsync({
          body: buildCreateObjectInput(draft),
        })
        committed = res as unknown as ObjectDTO
      }
    } catch (err) {
      // The write failed, so nothing was committed. Keep the draft exactly as the user left it:
      // no reset, no onSaved (which would close a create sheet), and deliberately NO cache
      // invalidation — on a 412 that would pull server truth and the reload effect would discard
      // the very edits the user still needs to re-apply. Returning (not rethrowing) is what stops
      // RHF re-throwing into an unhandled rejection.
      logger.error('Entity save failed', {
        entityId: entity?.id,
        status: iomStatus(err),
        err: err,
      })
      const message = saveErrorMessage(err)
      toast.error(t(message.key, message.values))
      form.setError('root.save', { type: 'server', message: message.key })
      return
    }

    const knownParents = new Set((entity?.parents ?? []).map((p) => p.id))
    const addedParents = entity
      ? draft.parentIds.filter((id) => !knownParents.has(id))
      : []

    attachUploads(committed, draft)
    // Clear the dirty baseline so the tab dot / unsaved bar reset immediately. A body change bumps the
    // version → the load effect re-syncs to the server truth (file ids/thumbnails); a file-only save
    // (no version bump) has no reload, so this reset is what clears the dot.
    form.reset(form.getValues())
    onSaved?.(committed.id, addedParents)
  })

  return {
    form,
    submit,
    isEditing: !!entity,
    // RHF holds this true for the WHOLE async handler, so it covers the post-save upload phase too —
    // the mutation flags alone go false while bytes are still going up.
    isSubmitting: form.formState.isSubmitting,
    reset: () => form.reset(),
  }
}
