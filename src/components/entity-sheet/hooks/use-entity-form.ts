'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectDTO } from 'io2p-client'

import { useObjects } from '@/hooks/api/entities'
import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { logger } from '@/lib'
import {
  type EntityDraft,
  dtoToDraft,
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
      await Promise.all(
        uploads.map((u) => client.files.upload(u.file.blob!, u.target))
      )
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
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    reset: () => form.reset(),
  }
}
