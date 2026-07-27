'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectDTO } from 'io2p-client'

import { useObjects } from '@/hooks/api/entities'
import { useIomClient } from '@/lib/io2p'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { queryKeys } from '@/lib/query-keys'
import { logger } from '@/lib'
import {
  type EntityDraft,
  dtoToDraft,
  findEmptyPropertyKey,
  hasPendingUploads,
  resolveUploadTargets,
  buildCreateObjectInput,
  buildUpdateObjectBody,
} from '@/lib/entity-body'

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
  /** Called after a successful create/update (or a no-op save) with the entity id. */
  onSaved?: (id: string) => void
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
  const { defaultParentIds, onSaved } = options
  const t = useTranslations()
  const client = useIomClient()
  const qc = useQueryClient()

  const initial: EntityDraft = entity
    ? dtoToDraft(entity)
    : { ...EMPTY_DRAFT, parentIds: defaultParentIds ?? [] }

  const form = useForm<EntityDraft>({ defaultValues: initial })

  const { useCreate, useUpdate } = useObjects()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  // Reload the form whenever a different entity (or a newer version after save) arrives.
  const loadedKey = entity ? `${entity.id}:${entity.currentVersion}` : 'new'
  useEffect(() => {
    form.reset(
      entity
        ? dtoToDraft(entity)
        : { ...EMPTY_DRAFT, parentIds: defaultParentIds ?? [] }
    )
  }, [loadedKey])

  // Attach pending picks against the committed object (upload → target). Best-effort: the entity is
  // already saved, so a failure toasts but doesn't roll back.
  const attachUploads = async (committed: ObjectDTO, draft: EntityDraft) => {
    const uploads = resolveUploadTargets(committed, draft)
    if (uploads.length === 0) return
    try {
      // One call, per-file targets. `uploadAll` uploads the bytes in parallel and gates the
      // `complete` calls per TARGET ENTITY — those writes are version-serialized server-side, so
      // fanning them out at one object only fights over its version. No grouping needed here: a
      // save spreads files across the entity, its properties and its values, but that's one
      // contention unit, and the SDK keys the gate on `target.entityId`.
      const settled = await client.files.uploadAll(
        uploads.map((u) => ({
          // An explicit descriptor rather than the raw File: the SDK would otherwise read
          // `File.name`, losing a rename. Renaming by rebuilding the File would copy the bytes.
          file: {
            data: u.file.blob!,
            fileName: u.file.fileName ?? u.file.blob!.name,
            contentType: u.file.contentType || u.file.blob!.type || undefined,
          },
          target: u.target,
        }))
      )

      // Settled per file, so a partial failure keeps the successes — reporting "nothing uploaded"
      // when four of five landed would be a lie, and would invite a retry that duplicates them.
      const failed = settled.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        logger.error('Some files failed to attach after save', {
          failed: failed.length,
          total: settled.length,
          error: failed
            .map((r) =>
              r.status === 'rejected'
                ? r.reason instanceof Error
                  ? r.reason.message
                  : String(r.reason)
                : ''
            )
            .join('; '),
        })
        toast.error(
          t('objects.files.uploadPartial', {
            failed: failed.length,
            total: settled.length,
          })
        )
      }
    } catch (err) {
      // Log the readable message — an Error serializes to `{}` when wrapped in an object.
      logger.error('File upload failed after save', {
        error: err instanceof Error ? err.message : String(err),
      })
      toast.error(t('objects.files.uploadFailed'))
    } finally {
      qc.invalidateQueries({ queryKey: queryKeys.objects.detail(committed.id) })
    }
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
        error: err instanceof Error ? err.message : String(err),
      })
      const message = saveErrorMessage(err)
      toast.error(t(message.key, message.values))
      form.setError('root.save', { type: 'server', message: message.key })
      return
    }

    await attachUploads(committed, draft)
    // Clear the dirty baseline so the tab dot / unsaved bar reset immediately. A body change bumps the
    // version → the load effect re-syncs to the server truth (file ids/thumbnails); a file-only save
    // (no version bump) has no reload, so this reset is what clears the dot.
    form.reset(form.getValues())
    onSaved?.(committed.id)
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
