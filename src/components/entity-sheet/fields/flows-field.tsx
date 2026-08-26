'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import { ChevronRight, Package, Plus, Repeat, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { EntityDraft } from '@/lib/entity'
import { QUANTITY_KEY } from '@/lib/entity'

import type { DerivedValues } from './value-provenance'

import { ObjectFilesField } from './object-files-field'
import { ObjectPicker } from './object-picker'
import { PropertyFields } from './property-fields'
import { DeletedRow } from './deleted-row'
import { useRefName } from './use-ref-name'

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
  derivedValues,
  entityId,
  optionalRef = false,
}: {
  form: UseFormReturn<EntityDraft>
  bag: Bag
  editing: boolean
  /** All property bags on the process — a flow formula may bind across flows (D76). */
  siblingSource?: EntityDraft['properties']
  /** Traces for the whole process aggregate; a flow value can be derived too. */
  derivedValues: DerivedValues
  entityId?: string
  /**
   * A TEMPLATE flow's target is a suggestion, not a requirement — the user picks the real object on
   * apply. So an empty row is a legitimate slot ("one input goes here") rather than an unfinished
   * one, and the picker says so instead of reading as a missing value.
   */
  optionalRef?: boolean
}) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: bag,
  })

  /**
   * Objects referenced on the OTHER side.
   *
   * The same object as both an input and an output is legal — io2p has no rule against it, and the
   * overview view exists partly to show recirculation (repair, reprocessing, a stockpile that comes
   * back finer). So this marks rather than blocks: a deliberate loop proceeds, an accidental
   * double-pick becomes visible immediately instead of surfacing later as a cut cycle in the Sankey.
   *
   * Watched once per bag rather than per row — every row asks the same question.
   */
  const oppositeRefs = useWatch({
    control: form.control,
    name: bag === 'inputs' ? 'outputs' : 'inputs',
  })
  const onBothSides = useMemo(
    () =>
      new Set(
        (oppositeRefs ?? [])
          .map((f) => f.ref)
          .filter((ref): ref is string => Boolean(ref))
      ),
    [oppositeRefs]
  )

  const addFlow = () =>
    append({ ref: '', properties: [] }, { shouldFocus: false })

  /**
   * Removing a STORED flow marks it, so Save sends a soft delete the server can reverse and the row
   * stays on screen struck-through with Restore. A flow that was never stored has nothing to
   * preserve, so it just goes. Identical to how a property is removed — flows only differed while
   * the backend hard-spliced them.
   */
  const removeFlow = (index: number) => {
    if (form.getValues(`${bag}.${index}.id`)) {
      form.setValue(`${bag}.${index}.deleted`, true, { shouldDirty: true })
    } else {
      remove(index)
    }
  }

  const restoreFlow = (index: number) =>
    form.setValue(`${bag}.${index}.deleted`, false, { shouldDirty: true })

  // Deliberately counts ALL rows, deleted included: a soft-deleted flow is shown struck-through in
  // read mode, exactly like a deleted property, so "no inputs" would be a lie about a bag that has
  // some. (The node rejects emptying a direction anyway, so a saved process always has a live one.)
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
          derivedValues={derivedValues}
          entityId={entityId}
          optionalRef={optionalRef}
          onBothSides={onBothSides}
          onRemove={() => removeFlow(index)}
          onRestore={() => restoreFlow(index)}
        />
      ))}

      {editing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`add-${bag.slice(0, -1)}`}
          onClick={addFlow}
        >
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
  derivedValues,
  entityId,
  optionalRef,
  onBothSides,
  onRemove,
  onRestore,
}: {
  form: UseFormReturn<EntityDraft>
  bag: Bag
  index: number
  editing: boolean
  siblingSource?: EntityDraft['properties']
  derivedValues: DerivedValues
  entityId?: string
  optionalRef?: boolean
  /** Object ids referenced on the opposite side, so a both-sides flow can say so. */
  onBothSides: Set<string>
  onRemove: () => void
  onRestore: () => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  const base = `${bag}.${index}` as const
  /**
   * `useWatch`, NOT `form.watch` — this row does not own the `useForm`, it receives it.
   *
   * `form.watch` in a child only READS: its subscription re-renders whichever component called
   * `useForm`, and this one re-rendered merely because its parent did. The React Compiler runs in
   * production only and memoizes this row on props that never change, so the cascade stops and the
   * value freezes. The identical defect in `property-fields` made soft-delete do nothing at all in
   * a production build while every dev run stayed green.
   */
  const flow = useWatch({ control: form.control, name: base })
  const properties = flow?.properties ?? []

  // A process flow arrives with `refName`; a TEMPLATE flow has no such field, so the id is resolved
  // here rather than printed.
  const refLabel = useRefName(flow?.ref, flow?.refName)

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

  const alsoOnOtherSide = !!flow?.ref && onBothSides.has(flow.ref)

  // Struck through and marked rather than gone — the same treatment a deleted property or file gets,
  // now that a flow removal is reversible. Restore is offered in edit mode only: it is a draft edit
  // that only Save can commit.
  if (flow?.deleted) {
    return (
      <DeletedRow
        label={refLabel || t('processes.flows.untitled')}
        onRestore={editing ? onRestore : undefined}
        testId={`flow-deleted-${bag}-${index}`}
      />
    )
  }

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
      data-testid={`flow-row-${bag}-${index}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Reading mode has nothing else interactive on the row, so the WHOLE row toggles — the same
            affordance a property has. Editing puts a picker and an input in the row, and a control
            cannot be nested inside a trigger, so there the chevron keeps the job. */}
        <CollapsibleTrigger
          aria-label={t('processes.flows.toggleDetails')}
          data-testid={`flow-toggle-${bag}-${index}`}
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-left',
            editing ? 'shrink-0' : 'flex-1'
          )}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          />
          {!editing && (
            <>
              {/* A flow names an OBJECT, not a property — the icon and the weight say so, because
                  the row otherwise looks exactly like the property rows above it. */}
              <Package
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {refLabel ||
                  (optionalRef ? (
                    <span className="font-normal italic text-muted-foreground">
                      {t('templates.flowSlot')}
                    </span>
                  ) : (
                    '—'
                  ))}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {quantity || '—'}
              </span>
            </>
          )}
        </CollapsibleTrigger>

        {editing && (
          <>
            <ObjectPicker
              className="min-w-0 flex-1"
              value={flow?.ref ?? ''}
              displayName={refLabel}
              placeholder={
                optionalRef ? t('templates.flowSlotPlaceholder') : undefined
              }
              onSelect={(id, name) => {
                form.setValue(`${base}.ref`, id, { shouldDirty: true })
                form.setValue(`${base}.refName`, name, { shouldDirty: false })
                // `use-process-form` refuses a flow with no object by calling `setError` BY HAND,
                // and `setValue` does not clear a manually set error. Without this the sheet stays
                // refused after the user has picked one — the save never fires again, and the only
                // way out is discarding the work the refusal existed to protect.
                if (id) form.clearErrors(`${base}.ref`)
              }}
            />
            <input
              className="h-8 w-28 shrink-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder={t('processes.flows.quantity')}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={t('processes.flows.quantity')}
              data-testid={`flow-quantity-${bag}-${index}`}
            />
          </>
        )}

        {/* Amber, not destructive: this is legal and sometimes deliberate (rework, reprocessing), so
            it must read as "check this", not "you broke something". The icon pairs with the text
            rather than replacing it — colour alone carries nothing. */}
        {alsoOnOtherSide && (
          <Badge
            variant="outline"
            className="h-5 shrink-0 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <Repeat className="h-3 w-3" aria-hidden="true" />
            {bag === 'inputs'
              ? t('processes.flows.alsoOutput')
              : t('processes.flows.alsoInput')}
          </Badge>
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
            data-testid={`flow-remove-${bag}-${index}`}
            // One click, no confirm: the removal is a soft delete the row itself offers to undo.
            // The old two-step existed because a flow removal used to be irreversible.
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <CollapsibleContent className="space-y-3 border-t bg-muted/10 px-3 py-2">
        <PropertyFields
          form={form}
          editing={editing}
          derivedValues={derivedValues}
          basePath={`${base}.properties`}
          siblingSource={siblingSource}
          label={t('objects.fields.properties')}
          allowViewToggle={false}
        />
        {/* Flow-level files. io2p scopes an attach target with `flow: {direction, flowId}`, so these
            belong to the FLOW, not to the process. Hidden entirely when a saved flow has none —
            a bare "Files" heading over nothing is noise repeated on every row. */}
        {(editing || (flow?.files?.length ?? 0) > 0) && (
          <ObjectFilesField
            form={form}
            editing={editing}
            entityId={entityId}
            basePath={`${base}.files`}
            allowViewToggle={false}
            showEmptyState={false}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
