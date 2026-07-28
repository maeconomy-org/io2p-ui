'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ObjectDTO } from 'io2p-client'

import { useTemplates } from '@/hooks/api/entities'
import { useConstants } from '@/hooks/api/leaves'
import { objectToTemplateInput } from '@/lib/template-body'
import { iomStatus, saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib'

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
  const [source, setSource] = useState<ObjectDTO | null>(null)
  const createMutation = useTemplates().useCreate()

  const usesConstants = useMemo(
    () =>
      (source?.properties ?? []).some((p) =>
        p.values.some((v) =>
          v.provenance?.args.some((a) => a.source.kind === 'constant')
        )
      ),
    [source]
  )
  const { data: constants } = useConstants().useList(
    { page: 1, size: 200 },
    { enabled: !!source && usesConstants }
  )
  const constantNames = useMemo(
    () => new Map((constants?.data ?? []).map((c) => [c.id, c.name])),
    [constants]
  )

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
      if (!source) return
      try {
        await createMutation.mutateAsync({
          body: objectToTemplateInput(
            source,
            {
              name: data.name.trim() || source.name,
              description: data.description.trim() || undefined,
              version: data.version.trim() || undefined,
            },
            constantNames
          ),
        })
        toast.success(t('objects.templateCreatedSuccess'))
        setSource(null)
      } catch (error) {
        logger.error('Create template from object failed', {
          objectId: source.id,
          status: iomStatus(error),
          error: error instanceof Error ? error.message : String(error),
        })
        toast.error(t(saveErrorMessage(error).key))
      }
    },
    [source, createMutation, constantNames, t]
  )

  return {
    source,
    setSource,
    initialData,
    confirm,
    isCreating: createMutation.isPending,
  }
}
