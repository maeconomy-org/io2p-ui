'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { ObjectDTO } from 'io2p-client'

import { useObjects } from '@/hooks/api/entities'
import {
  type EntityDraft,
  dtoToDraft,
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

  const submit = form.handleSubmit(async (draft) => {
    if (entity) {
      const body = buildUpdateObjectBody(entity, draft)
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
      body: buildCreateObjectInput(draft),
    })
    onSaved?.(res.id)
  })

  return {
    form,
    submit,
    isEditing: !!entity,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    reset: () => form.reset(),
  }
}
