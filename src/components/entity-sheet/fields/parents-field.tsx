'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Badge, Button } from '@/components/ui'
import type { EntityDraft } from '@/lib/entity-body'

// Re-parenting via an object picker is a follow-up (shared with process flows); v1 shows the current
// parents and allows removal. Names come from the loaded entity's parents[] (id -> name).
export function ParentsField({
  form,
  editing,
  parentNames,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  parentNames: Map<string, string>
}) {
  const t = useTranslations()
  const parentIds = form.watch('parentIds')

  if (parentIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('objects.detailsSheet.noParents')}
      </p>
    )
  }

  const remove = (id: string) =>
    form.setValue(
      'parentIds',
      parentIds.filter((p) => p !== id),
      { shouldDirty: true }
    )

  return (
    <div className="flex flex-wrap gap-2">
      {parentIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1">
          {parentNames.get(id) ?? id}
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              aria-label={t('common.remove')}
              onClick={() => remove(id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </Badge>
      ))}
    </div>
  )
}
