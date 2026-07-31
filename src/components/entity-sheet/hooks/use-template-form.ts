'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { CreateTemplateInput, TemplateDTO } from 'io2p-client'

import { useTemplates } from '@/hooks/api/entities'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/logger'
import {
  type TemplateDraft,
  EMPTY_TEMPLATE_DRAFT,
  EMPTY_PROCESS_TEMPLATE_DRAFT,
  templateToDraft,
  buildCreateTemplateInput,
  buildUpdateTemplateBody,
} from '@/lib/template-body'

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

  const form = useForm<TemplateDraft>({
    defaultValues: template ? templateToDraft(template) : EMPTY_DRAFTS[type],
  })

  const { useCreate, useUpdate } = useTemplates()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  // What the draft is OF. `type` belongs here because switching kinds changes the empty shape, and a
  // create sheet reopened for the other kind must not keep the first one's flow slots.
  const loadedKey = template
    ? `${template.id}:${template.currentVersion}`
    : `new:${type}`

  useEffect(() => {
    form.reset(template ? templateToDraft(template) : EMPTY_DRAFTS[type])
    // Deliberately keyed on WHICH template is loaded, not on the identities of `form`/`template`.
    // RHF returns a new `form` object every render and a refetch returns a new `template` object, so
    // an exhaustive list would reset the draft mid-edit and discard what the user had typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey])

  const submit = form.handleSubmit(async (draft) => {
    if (!draft.name.trim()) {
      form.setError('name', { type: 'required' })
      toast.error(t('templates.nameRequired'))
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
        error: err instanceof Error ? err.message : String(err),
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
