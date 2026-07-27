'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { TemplateDTO } from 'io2p-client'

import { useTemplates } from '@/hooks/api/entities'
import { useOptionalUploadQueue } from '@/contexts/upload-queue-context'
import { useIomClient } from '@/lib/io2p'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'
import { hasPendingUploads, resolveUploadTargets } from '@/lib/entity-body'
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
 * The two failure paths are separated for the same reason they are on objects: an upload that fails
 * after a successful save must not roll the form back into "unsaved", because the template WAS saved.
 */
export function useTemplateForm(
  template?: TemplateDTO | null,
  options: UseTemplateFormOptions = {}
) {
  const { onSaved } = options
  const t = useTranslations()
  const client = useIomClient()
  const uploadQueue = useOptionalUploadQueue()

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
        committed = hasPendingUploads(draft)
          ? await client.templates.get(template.id)
          : template
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

    attachUploads(committed, draft)
    form.reset(form.getValues())
    onSaved?.(committed.id)
  })

  /**
   * Templates carry files at the same three levels objects do, and the target resolver only reads
   * id + properties, so it works unchanged — the shape it wants is the part templates share.
   */
  const attachUploads = (committed: TemplateDTO, draft: TemplateDraft) => {
    const uploads = resolveUploadTargets(asObjectShape(committed), draft)
    if (uploads.length === 0) return
    uploadQueue?.enqueue(
      uploads.map((u) => ({
        id: crypto.randomUUID(),
        fileName: u.file.fileName ?? u.file.blob!.name,
        size: u.file.blob!.size,
        contentType: u.file.contentType || u.file.blob!.type || undefined,
        file: {
          data: u.file.blob!,
          fileName: u.file.fileName ?? u.file.blob!.name,
          contentType: u.file.contentType || u.file.blob!.type || undefined,
        },
        target: u.target,
      }))
    )
  }

  return {
    form,
    submit,
    isEditing: !!template,
    isSubmitting: form.formState.isSubmitting,
  }
}

// resolveUploadTargets only reads id + properties, both of which a TemplateDTO has in the same shape.
const asObjectShape = (template: TemplateDTO) =>
  template as unknown as Parameters<typeof resolveUploadTargets>[0]
