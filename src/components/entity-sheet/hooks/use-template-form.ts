'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { CreateTemplateInput, TemplateDTO } from 'io2p-client'

import { useTemplates } from '@/hooks/api/entities'
import { findEmptyPropertyKey } from '@/lib/entity'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import {
  type TemplateDraft,
  EMPTY_TEMPLATE_DRAFT,
  EMPTY_PROCESS_TEMPLATE_DRAFT,
  templateToDraft,
  buildCreateTemplateInput,
  buildUpdateTemplateBody,
} from '@/lib/entity'

/**
 * The starting draft per kind. A process template opens with one slot on each side; an object
 * template has no flow bags at all, so the replace model never writes empty ones over nothing.
 *
 * Module-level on purpose — a local would be a new object each render and therefore a reactive
 * dependency of the reset effect below.
 */
const EMPTY_DRAFTS = {
  object: EMPTY_TEMPLATE_DRAFT,
  process: EMPTY_PROCESS_TEMPLATE_DRAFT,
} as const

export interface UseTemplateFormOptions {
  onSaved?: (id: string) => void
  /** Which kind a CREATE will be. An edit takes the loaded template's own type. */
  type?: NonNullable<CreateTemplateInput['type']>
}

/**
 * The template counterpart of `useEntityForm`. Same contract — load into a draft, build one write
 * body on submit, no-op when nothing changed — over the template resource, whose PATCH replaces
 * collections rather than diffing them.
 *
 * Unlike objects there is no post-save upload step: io2p resolves a file's attach target through the
 * engine registry, which holds only objects and processes, so a template can never be an upload
 * target. The save is therefore the whole story — one write, no second phase that can fail after it.
 */
export function useTemplateForm(
  template?: TemplateDTO | null,
  options: UseTemplateFormOptions = {}
) {
  const { onSaved, type = 'object' } = options
  const t = useTranslations()

  // What the draft is OF. `type` belongs here because switching kinds changes the empty shape, and a
  // create sheet reopened for the other kind must not keep the first one's flow slots.
  const loadedKey = template
    ? `${template.id}:${template.currentVersion}`
    : `new:${type}`

  /**
   * `values`, not a `reset` in an effect.
   *
   * The sheet renders a skeleton while the fetch is in flight, so opening a template straight in
   * EDIT mode mounts its inputs in the same commit the data arrives — and a reset fired from an
   * effect never reached them. Name and Description came up blank on a template that has both, and
   * saving then wrote the blanks back. RHF applies `values` as part of the render that introduces
   * them, which is the ordering this needs.
   *
   * MEMOISED on `loadedKey`: `templateToDraft` mints a new object every render, and `values`
   * re-syncs whenever the reference changes — unmemoised it would wipe the draft on every keystroke.
   */
  const values = useMemo(
    () => (template ? templateToDraft(template) : EMPTY_DRAFTS[type]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey]
  )

  const form = useForm<TemplateDraft>({
    defaultValues: EMPTY_DRAFTS[type],
    values,
    // A refetch mid-edit must not discard what the user has typed.
    resetOptions: { keepDirtyValues: true },
  })

  const { useCreate, useUpdate } = useTemplates()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  const submit = form.handleSubmit(async (draft) => {
    if (!draft.name.trim()) {
      form.setError('name', { type: 'required' })
      toast.error(t('templates.nameRequired'))
      return
    }

    // `properties()` at `template.ts:235` filters out anything with a blank key, so without this
    // the save SUCCEEDS, the node never sees the value, and reopening shows no property row —
    // silent data loss rather than a refusal. The object and process sheets already guard this;
    // the template sheet was the one path that did not.
    const nameless = findEmptyPropertyKey(draft)
    if (nameless >= 0) {
      form.setError(`properties.${nameless}.key`, { type: 'required' })
      toast.error(t('objects.saveError.propertyKeyRequired'))
      return
    }

    let committed: TemplateDTO
    try {
      if (template) {
        const body = buildUpdateTemplateBody(template, draft)
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ id: template.id, body })
        }
        committed = template
      } else {
        committed = (await createMutation.mutateAsync({
          body: buildCreateTemplateInput(draft, type),
        })) as unknown as TemplateDTO
      }
    } catch (err) {
      logger.error('Template save failed', {
        templateId: template?.id,
        status: iomStatus(err),
        err: err,
      })
      const message = saveErrorMessage(err)
      toast.error(t(message.key, message.values))
      form.setError('root.save', { type: 'server', message: message.key })
      return
    }

    form.reset(form.getValues())
    onSaved?.(committed.id)
  })

  return {
    form,
    submit,
    isEditing: !!template,
    isSubmitting: form.formState.isSubmitting,
  }
}
