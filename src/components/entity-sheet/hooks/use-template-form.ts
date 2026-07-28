'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { TemplateDTO } from 'io2p-client'

import { useTemplates } from '@/hooks/api/entities'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'
import {
  type TemplateDraft,
  EMPTY_TEMPLATE_DRAFT,
  templateToDraft,
  buildCreateTemplateInput,
  buildUpdateTemplateBody,
} from '@/lib/template-body'

export interface UseTemplateFormOptions {
  onSaved?: (id: string) => void
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
  const { onSaved } = options
  const t = useTranslations()

  const form = useForm<TemplateDraft>({
    defaultValues: template ? templateToDraft(template) : EMPTY_TEMPLATE_DRAFT,
  })

  const { useCreate, useUpdate } = useTemplates()
  const createMutation = useCreate()
  const updateMutation = useUpdate()

  const loadedKey = template
    ? `${template.id}:${template.currentVersion}`
    : 'new'
  useEffect(() => {
    form.reset(template ? templateToDraft(template) : EMPTY_TEMPLATE_DRAFT)
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
          body: buildCreateTemplateInput(draft),
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
