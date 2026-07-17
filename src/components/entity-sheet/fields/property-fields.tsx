'use client'

import { useLocale, useTranslations } from 'next-intl'
import { FunctionSquare, Plus, Trash2, TextInitial } from 'lucide-react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'

import { Badge, Button, Label } from '@/components/ui'
import { cn } from '@/lib'
import { PropertyNameCombobox } from '@/components/properties'
import {
  getValuePlaceholder,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type { EntityDraft, DraftValue } from '@/lib/entity-body'

import {
  FormulaSelect,
  FormulaBindings,
  type FormulaSibling,
} from './formula-value-editor'

interface PropertyFieldsProps {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  /** Value ids whose source is derived on the loaded entity — read-only (editing is phase 2). */
  derivedValueIds: Set<string>
}

// A new value carries a client `ref` so a sibling formula can bind to it (calc arg -> ref).
function newValue(): DraftValue {
  return { data: '', ref: crypto.randomUUID() }
}

// Numeric draft values a formula can bind to: key = existing id ?? new ref. Non-numeric values
// (pure text) are excluded — a formula can only compute over numbers.
function collectSiblings(
  properties: EntityDraft['properties'],
  selfKey: string | undefined
): FormulaSibling[] {
  const out: FormulaSibling[] = []
  properties.forEach((p) => {
    p.values.forEach((v) => {
      const key = v.id ?? v.ref
      if (!key || key === selfKey || v.calc) return // skip self + other formulas
      const num = Number.parseFloat(v.data ?? '')
      if (Number.isFinite(num)) {
        out.push({ key, label: p.label || p.key || '—', num })
      }
    })
  })
  return out
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ key: '', label: '', values: [newValue()] })}
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

  const propKey = form.watch(`properties.${index}.key`)
  const valuePlaceholder =
    getValuePlaceholder(propKey, locale) ?? t('objects.propertyEditor.value')
  const allProperties = form.watch('properties')

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>{t('objects.propertyEditor.name')}</Label>
          <PropertyNameCombobox
            className="h-10"
            placeholder={t('objects.propertyEditor.namePlaceholder')}
            value={propKey ?? ''}
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
            const base = `properties.${index}.values.${vIndex}` as const
            const value = form.watch(base)
            const existingDerived =
              !!value?.id && derivedValueIds.has(value.id) && !value.calc
            const isFormula = !!value?.calc
            const selfKey = value?.id ?? value?.ref

            // Loaded derived values render read-only until the provenance editor lands (phase 2).
            if (existingDerived) {
              return (
                <div
                  key={field.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span>{value?.data || '—'}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {t('objects.propertyEditor.derived')}
                  </Badge>
                </div>
              )
            }

            const toggleLabel = isFormula
              ? t('objects.formulaEditor.switchToText')
              : t('objects.formulaEditor.switchToFormula')

            return (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {/* One field, mode-switch button inside (currency-selector pattern). */}
                  <div className="flex flex-1 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    {isFormula ? (
                      <FormulaSelect
                        className="h-10 flex-1 border-0 shadow-none focus:ring-0 focus:ring-offset-0"
                        formulaId={value?.calc?.formulaId}
                        onSelect={(formulaId) =>
                          form.setValue(
                            `${base}.calc`,
                            { formulaId, args: [] },
                            { shouldDirty: true }
                          )
                        }
                      />
                    ) : (
                      <input
                        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder={valuePlaceholder}
                        {...form.register(`${base}.data`)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        form.setValue(
                          `${base}.calc`,
                          isFormula ? undefined : { args: [] },
                          { shouldDirty: true }
                        )
                      }
                      title={toggleLabel}
                      aria-label={toggleLabel}
                      className={cn(
                        'flex h-10 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground',
                        isFormula && 'text-primary'
                      )}
                    >
                      {isFormula ? (
                        <TextInitial className="h-4 w-4" />
                      ) : (
                        <FunctionSquare className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.remove')}
                    onClick={() => remove(vIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {isFormula && value?.calc?.formulaId && (
                  <FormulaBindings
                    calc={value.calc}
                    siblings={collectSiblings(allProperties, selfKey)}
                    onChange={(calc) =>
                      form.setValue(`${base}.calc`, calc, { shouldDirty: true })
                    }
                  />
                )}
              </div>
            )
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append(newValue())}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('objects.propertyEditor.addValue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
