'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectDTO } from 'io2p-client'

import { useObjects } from '@/hooks/api/entities'
import { useFileByteUpload } from '@/hooks/api/files'
import { logger } from '@/lib'
import {
  type EntityDraft,
  type FileIdMap,
  dtoToDraft,
  collectPendingUploads,
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
 */
export function useEntityForm(
  entity?: ObjectDTO | null,
  options: UseEntityFormOptions = {}
) {
  const { defaultParentIds, onSaved } = options
  const t = useTranslations()

  const initial: EntityDraft = entity
    ? dtoToDraft(entity)
    : { ...EMPTY_DRAFT, parentIds: defaultParentIds ?? [] }

  const form = useForm<EntityDraft>({ defaultValues: initial })

  const { useCreate, useUpdate } = useObjects()
  const createMutation = useCreate()
  const updateMutation = useUpdate()
  const byteUpload = useFileByteUpload()

  // Lazy upload: push every pending pick's bytes to S3 (no target), returning `_localId → file id`.
  // Uploads run in parallel; any failure rejects so submit aborts before touching the entity.
  const uploadPending = async (draft: EntityDraft): Promise<FileIdMap> => {
    const pending = collectPendingUploads(draft)
    if (pending.length === 0) return new Map()
    const entries = await Promise.all(
      pending.map(async (f) => {
        const res = await byteUpload.mutateAsync({ file: f.blob! })
        return [f._localId, res.file.id] as const
      })
    )
    return new Map(entries)
  }

  // Reload the form whenever a different entity (or a newer version after save) arrives.
  const loadedKey = entity ? `${entity.id}:${entity.currentVersion}` : 'new'
  useEffect(() => {
    form.reset(
      entity
        ? dtoToDraft(entity)
        : { ...EMPTY_DRAFT, parentIds: defaultParentIds ?? [] }
    )
  }, [loadedKey])

  const submit = form.handleSubmit(async (draft) => {
    // Uploads happen first; if any fails we abort BEFORE the entity write, so no half-attached state.
    let fileIdMap: FileIdMap
    try {
      fileIdMap = await uploadPending(draft)
    } catch (err) {
      logger.error('File upload failed during save', { error: err })
      toast.error(t('objects.files.uploadFailed'))
      return
    }

    if (entity) {
      const body = buildUpdateObjectBody(entity, draft, fileIdMap)
      if (Object.keys(body).length > 0) {
        await updateMutation.mutateAsync({
          id: entity.id,
          body,
          options: { ifMatch: entity.currentVersion },
        })
      }
      onSaved?.(entity.id)
      return
    }
    const res = await createMutation.mutateAsync({
      body: buildCreateObjectInput(draft, fileIdMap),
    })
    onSaved?.(res.id)
  })

  return {
    form,
    submit,
    isEditing: !!entity,
    isSubmitting:
      byteUpload.isPending ||
      createMutation.isPending ||
      updateMutation.isPending,
    reset: () => form.reset(),
  }
}
