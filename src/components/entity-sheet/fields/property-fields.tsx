'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'

import { Badge, Button, Input, Label } from '@/components/ui'
import { PropertyNameCombobox } from '@/components/properties'
import {
  getValuePlaceholder,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type { EntityDraft } from '@/lib/entity-body'

interface PropertyFieldsProps {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  /** Value ids whose source is derived — rendered read-only (formula re-binding is a follow-up). */
  derivedValueIds: Set<string>
}

export function PropertyFields({
  form,
  editing,
  derivedValueIds,
}: PropertyFieldsProps) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'properties',
  })

  if (!editing) {
    const properties = form.watch('properties')
    if (properties.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('objects.detailsSheet.noProperties')}
        </p>
      )
    }
    return (
      <div className="space-y-4">
        {properties.map((p, i) => (
          <div key={p.id ?? i} className="rounded-md border p-3">
            <div className="text-sm font-medium">{p.label || p.key}</div>
            <div className="mt-1 space-y-1">
              {p.values.length === 0 && (
                <span className="text-sm text-muted-foreground">—</span>
              )}
              {p.values.map((v, vi) => (
                <div
                  key={v.id ?? vi}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>{v.data || '—'}</span>
                  {v.id && derivedValueIds.has(v.id) && (
                    <Badge variant="outline" className="text-[10px]">
                      {t('objects.propertyEditor.derived')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <PropertyRow
          key={field.id}
          form={form}
          index={index}
          derivedValueIds={derivedValueIds}
          onRemove={() => remove(index)}
        />
      ))}
      {/* A new property always starts with one (empty) value. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ key: '', label: '', values: [{ data: '' }] })}
      >
        <Plus className="mr-2 h-4 w-4" />
        {t('objects.propertyEditor.addProperty')}
      </Button>
    </div>
  )
}

function PropertyRow({
  form,
  index,
  derivedValueIds,
  onRemove,
}: {
  form: UseFormReturn<EntityDraft>
  index: number
  derivedValueIds: Set<string>
  onRemove: () => void
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `properties.${index}.values`,
  })

  // Selecting a known property surfaces its expected-format example as the value placeholder.
  const propKey = form.watch(`properties.${index}.key`)
  const valuePlaceholder =
    getValuePlaceholder(propKey, locale) ?? t('objects.propertyEditor.value')

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>{t('objects.propertyEditor.name')}</Label>
          <PropertyNameCombobox
            className="h-10"
            value={form.watch(`properties.${index}.key`) ?? ''}
            onChange={(key, label) => {
              form.setValue(`properties.${index}.key`, key, {
                shouldDirty: true,
              })
              form.setValue(`properties.${index}.label`, label, {
                shouldDirty: true,
              })
            }}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('common.remove')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>{t('objects.propertyEditor.value')}</Label>
        <div className="space-y-2">
          {fields.map((field, vIndex) => {
            const valueId = form.watch(
              `properties.${index}.values.${vIndex}.id`
            )
            const isDerived = !!valueId && derivedValueIds.has(valueId)
            return (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={valuePlaceholder}
                  readOnly={isDerived}
                  {...form.register(
                    `properties.${index}.values.${vIndex}.data`
                  )}
                />
                {isDerived ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {t('objects.propertyEditor.derived')}
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.remove')}
                    onClick={() => remove(vIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ data: '' })}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('objects.propertyEditor.addValue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
