'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectListItem } from 'io2p-client'

import { useObjects, useTemplates } from '@/hooks/api/entities'
import { objectToTemplateInput } from '@/lib/entity'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

export interface TemplateCreationData {
  name: string
  description: string
  version: string
}

/**
 * "Create template from this object", shared by both object pages so it can't drift between them.
 *
 * Writes a real io2p template. The previous implementation went through the legacy statement/import
 * API, so what it produced never appeared on `/templates` at all — and the statement shape has no
 * `calc`, so a formula could not have survived it either way.
 *
 * Constants are fetched only while the dialog is open: a formula argument bound to a constant is
 * traced by id but authored by NAME, so the recipe can't be rebuilt without the directory. Objects
 * whose formulas bind only sibling values never pay for the request.
 */
export function useCreateTemplateFromObject() {
  const t = useTranslations()
  // The TRIGGER is a list row, which is lean — it has an id and a name and no properties. The
  // template is built from the authored tree, so the full object is fetched when the dialog opens.
  // Reading `properties` off the row instead would silently build a template with none: no error,
  // no missing field, just an empty recipe.
  const [source, setSource] = useState<ObjectListItem | null>(null)
  const { data: full } = useObjects().useGet(source?.id)
  const createMutation = useTemplates().useCreate()

  const initialData = useMemo(
    (): TemplateCreationData => ({
      name: source ? t('objects.templateNameFrom', { name: source.name }) : '',
      description: source?.description ?? '',
      version: '1.0',
    }),
    [source, t]
  )

  const confirm = useCallback(
    async (data: TemplateCreationData) => {
      // `full`, never `source` — the row cannot build a template.
      if (!full) return
      try {
        await createMutation.mutateAsync({
          body: objectToTemplateInput(full, {
            name: data.name.trim() || full.name,
            description: data.description.trim() || undefined,
            version: data.version.trim() || undefined,
          }),
        })
        toast.success(t('objects.templateCreatedSuccess'))
        setSource(null)
      } catch (error) {
        logger.error('Create template from object failed', {
          objectId: full.id,
          status: iomStatus(error),
          err: error,
        })
        toast.error(t(saveErrorMessage(error).key))
      }
    },
    [full, createMutation, t]
  )

  return {
    source,
    setSource,
    initialData,
    confirm,
    isCreating: createMutation.isPending,
  }
}
