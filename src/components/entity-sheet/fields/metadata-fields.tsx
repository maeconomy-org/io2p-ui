'use client'

import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { Input, Label, Textarea } from '@/components/ui'
import type { EntityDraft } from '@/lib/entity-body'

import { ReadOnlyField } from './read-only-field'

export function MetadataFields({
  form,
  editing,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
}) {
  const t = useTranslations()

  if (!editing) {
    const name = form.watch('name')
    const description = form.watch('description')
    return (
      <dl className="space-y-4">
        <ReadOnlyField label={t('objects.fields.name')}>
          {name || '—'}
        </ReadOnlyField>
        <ReadOnlyField label={t('objects.fields.description')}>
          {description || '—'}
        </ReadOnlyField>
      </dl>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="entity-name">{t('objects.fields.name')}</Label>
        <Input
          id="entity-name"
          {...form.register('name', { required: true })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entity-description">
          {t('objects.fields.description')}
        </Label>
        <Textarea
          id="entity-description"
          rows={3}
          {...form.register('description')}
        />
      </div>
    </div>
  )
}
