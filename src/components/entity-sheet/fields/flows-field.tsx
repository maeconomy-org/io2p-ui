'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

import { Badge, Button, Collapsible, CollapsibleContent } from '@/components/ui'
import { cn } from '@/lib'
import type { EntityDraft } from '@/lib/entity-body'
import { QUANTITY_KEY } from '@/lib/process-body'

import { ObjectPicker } from './object-picker'
import { PropertyFields } from './property-fields'

type Bag = 'inputs' | 'outputs'

/**
 * A process's input or output flows.
 *
 * Each row is the target object plus its quantity, because that is what a flow is read for; the rest
 * of the flow's data expands underneath using the SAME property editor objects use, so a flow stays
 * as customizable as anything else in the model.
 *
 * `quantity` is a UI convention, not a field — io2p keeps domain semantics above the protocol, so it
 * is an ordinary property that happens to be surfaced on the row.
 */
export function FlowsField({
  form,
  bag,
  editing,
  siblingSource,
}: {
  form: UseFormReturn<EntityDraft>
  bag: Bag
  editing: boolean
  /** All property bags on the process — a flow formula may bind across flows (D76). */
  siblingSource?: EntityDraft['properties']
}) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: bag,
  })

  const addFlow = () =>
    append({ ref: '', properties: [] }, { shouldFocus: false })

  if (fields.length === 0 && !editing) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(`processes.flows.empty.${bag}`)}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <FlowRow
          key={field.id}
          form={form}
          bag={bag}
          index={index}
          editing={editing}
          siblingSource={siblingSource}
          onRemove={() => remove(index)}
        />
      ))}

      {editing && (
        <Button type="button" variant="outline" size="sm" onClick={addFlow}>
          <Plus className="mr-2 h-4 w-4" />
          {t(`processes.flows.add.${bag}`)}
        </Button>
      )}
    </div>
  )
}

function FlowRow({
  form,
  bag,
  index,
  editing,
  siblingSource,
  onRemove,
}: {
  form: UseFormReturn<EntityDraft>
  bag: Bag
  index: number
  editing: boolean
  siblingSource?: EntityDraft['properties']
  onRemove: () => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const base = `${bag}.${index}` as const
  const flow = form.watch(base)
  const properties = flow?.properties ?? []

  const quantityIndex = properties.findIndex(
    (p) => p.key === QUANTITY_KEY && !p.deleted
  )
  const quantity =
    quantityIndex >= 0
      ? (properties[quantityIndex].values.find((v) => !v.deleted)?.data ?? '')
      : ''
  // Everything except the quantity already shown on the row.
  const otherCount = properties.filter(
    (p, i) => i !== quantityIndex && !p.deleted
  ).length

  /**
   * Write the quantity, creating the property the first time. Kept here rather than making the user
   * add a property named "quantity" by hand: it is the one flow field that is effectively always
   * wanted, and the Sankey reads it.
   */
  const setQuantity = (value: string) => {
    if (quantityIndex >= 0) {
      const values = properties[quantityIndex].values
      const vIndex = values.findIndex((v) => !v.deleted)
      if (vIndex >= 0) {
        form.setValue(
          `${base}.properties.${quantityIndex}.values.${vIndex}.data`,
          value,
          { shouldDirty: true }
        )
        return
      }
    }
    form.setValue(
      `${base}.properties`,
      [...properties, { key: QUANTITY_KEY, values: [{ data: value }] }],
      { shouldDirty: true }
    )
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border', open && 'shadow-sm')}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={t('processes.flows.toggleDetails')}
          aria-expanded={open}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              open && 'rotate-90'
            )}
          />
        </button>

        {editing ? (
          <ObjectPicker
            className="min-w-0 flex-1"
            value={flow?.ref ?? ''}
            displayName={flow?.refName}
            onSelect={(id, name) => {
              form.setValue(`${base}.ref`, id, { shouldDirty: true })
              form.setValue(`${base}.refName`, name, { shouldDirty: false })
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm">
            {flow?.refName || flow?.ref || '—'}
          </span>
        )}

        {editing ? (
          <input
            className="h-8 w-28 shrink-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder={t('processes.flows.quantity')}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label={t('processes.flows.quantity')}
          />
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">
            {quantity || '—'}
          </span>
        )}

        {otherCount > 0 && (
          <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
            +{otherCount}
          </Badge>
        )}

        {editing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            aria-label={t('common.remove')}
            // Two-step, and NOT the struck-through + Restore used elsewhere: removing a flow emits
            // `unlink`, which drops it and all its data from the projection with no way back.
            onBlur={() => setConfirmRemove(false)}
            onClick={() => {
              if (!confirmRemove) return setConfirmRemove(true)
              onRemove()
            }}
          >
            {confirmRemove ? (
              <span className="text-[10px] font-medium">
                {t('common.confirm')}
              </span>
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      <CollapsibleContent className="border-t bg-muted/10 px-3 py-2">
        <PropertyFields
          form={form}
          editing={editing}
          derivedValues={NO_DERIVED_VALUES}
          basePath={`${base}.properties`}
          siblingSource={siblingSource}
          label={t('objects.fields.properties')}
          allowFiles={false}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

// Flow-level derived values are read from the process aggregate, which the sheet passes down; until
// the trace is threaded per flow there is nothing flow-specific to show.
const NO_DERIVED_VALUES = new Map<string, never>()
