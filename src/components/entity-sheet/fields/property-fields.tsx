'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ChevronRight,
  FunctionSquare,
  Paperclip,
  Plus,
  Trash2,
  TextInitial,
} from 'lucide-react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Label,
} from '@/components/ui'
import { cn } from '@/lib'
import { PropertyNameCombobox } from '@/components/properties'
import {
  getValuePlaceholder,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type { EntityDraft, DraftValue, DraftFile } from '@/lib/entity-body'

import {
  FormulaSelect,
  FormulaBindings,
  type FormulaSibling,
} from './formula-value-editor'
import { AttachmentModal, FilesDisclosure } from '../files'
import { PropertyReadView } from './property-read-view'

interface PropertyFieldsProps {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  /** Value ids whose source is derived on the loaded entity — read-only (editing is phase 2). */
  derivedValueIds: Set<string>
  entityId?: string
  /** Renders a header row (label + Add) instead of a trailing Add button — used by the create shell. */
  label?: string
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
  entityId,
  label,
}: PropertyFieldsProps) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'properties',
  })

  /**
   * Patch one file anywhere under the properties tree, found by its `_localId` (unique across the
   * draft). Soft delete / restore already happened server-side, so this only catches the draft up —
   * `shouldDirty: false` because there is nothing left to save. One walker rather than a per-path
   * setter keeps the read view and the edit rows on identical behaviour.
   */
  const patchFile = (
    localId: string,
    patch: Partial<DraftFile>,
    options?: { dirty?: boolean }
  ) => {
    const apply = (fs?: DraftFile[]) =>
      fs?.map((f) => (f._localId === localId ? { ...f, ...patch } : f))
    form.setValue(
      'properties',
      form.getValues('properties').map((p) => ({
        ...p,
        files: apply(p.files),
        values: p.values.map((v) => ({ ...v, files: apply(v.files) })),
      })),
      { shouldDirty: options?.dirty ?? false }
    )
  }

  if (!editing) {
    return (
      <PropertyReadView
        properties={form.watch('properties')}
        derivedValueIds={derivedValueIds}
        entityId={entityId}
        onFileChange={patchFile}
      />
    )
  }

  const addProperty = () =>
    // RHF focuses the last registered input of the appended item — the value field — but a new
    // property wants its NAME first. Suppress that and let the row focus its own name input.
    append({ key: '', label: '', values: [newValue()] }, { shouldFocus: false })
  const addButton = (
    <Button type="button" variant="outline" size="sm" onClick={addProperty}>
      <Plus className="mr-2 h-4 w-4" />
      {t('objects.propertyEditor.addProperty')}
    </Button>
  )

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{label}</h3>
          {addButton}
        </div>
      )}
      {fields.map((field, index) => (
        <PropertyRow
          key={field.id}
          form={form}
          index={index}
          derivedValueIds={derivedValueIds}
          entityId={entityId}
          onFileChange={patchFile}
          onRemove={() => remove(index)}
        />
      ))}
      {!label && addButton}
    </div>
  )
}

// The modal target within a row: the property itself, or one of its values (by field index).
type ModalTarget = { kind: 'property' } | { kind: 'value'; vIndex: number }

function PropertyRow({
  form,
  index,
  derivedValueIds,
  entityId,
  onFileChange,
  onRemove,
}: {
  form: UseFormReturn<EntityDraft>
  index: number
  derivedValueIds: Set<string>
  entityId?: string
  onFileChange: (localId: string, patch: Partial<DraftFile>) => void
  onRemove: () => void
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `properties.${index}.values`,
  })
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // New properties (no key yet) open expanded to edit; loaded ones start collapsed to stay compact.
  const [isNew] = useState(() => !form.getValues(`properties.${index}.key`))
  const [open, setOpen] = useState(isNew)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) nameRef.current?.focus()
  }, [isNew])

  const propKey = form.watch(`properties.${index}.key`)
  const propLabel = form.watch(`properties.${index}.label`)
  const valuePlaceholder =
    getValuePlaceholder(propKey, locale) ?? t('objects.propertyEditor.value')
  const allProperties = form.watch('properties')
  const propFiles = form.watch(`properties.${index}.files`) ?? []
  const rowValues = allProperties[index]?.values ?? []
  const fileTotal =
    propFiles.length + rowValues.reduce((n, v) => n + (v.files?.length ?? 0), 0)
  // A property worth confirming before delete: it has a name, files, or any non-empty value.
  const hasContent =
    !!propKey ||
    propFiles.length > 0 ||
    rowValues.some(
      (v) => (v.data ?? '').trim() !== '' || (v.files?.length ?? 0) > 0
    )

  // Append files to the current modal target's draft `files` array (nothing uploads — lazy at Save).
  const addFiles = (files: DraftFile[]) => {
    if (!modalTarget) return
    const path =
      modalTarget.kind === 'property'
        ? (`properties.${index}.files` as const)
        : (`properties.${index}.values.${modalTarget.vIndex}.files` as const)
    const current = form.getValues(path) ?? []
    form.setValue(path, [...current, ...files], { shouldDirty: true })
  }

  const removeFile = (
    path:
      | `properties.${number}.files`
      | `properties.${number}.values.${number}.files`,
    localId: string
  ) => {
    const current = form.getValues(path) ?? []
    form.setValue(
      path,
      current.filter((f) => f._localId !== localId),
      { shouldDirty: true }
    )
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border', open && 'shadow-sm')}
    >
      <div className="flex items-center gap-1 px-3 py-1.5">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              open && 'rotate-90'
            )}
          />
          <span className="truncate text-sm font-medium">
            {propLabel || propKey || (
              <span className="italic text-muted-foreground">
                {t('objects.propertyEditor.namePlaceholder')}
              </span>
            )}
          </span>
          {fileTotal > 0 && (
            <Badge
              variant="secondary"
              className="h-4 shrink-0 gap-0.5 px-1 text-[10px]"
            >
              <Paperclip className="h-2.5 w-2.5" />
              {fileTotal}
            </Badge>
          )}
        </CollapsibleTrigger>
        {confirmDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              setConfirmDelete(false)
              onRemove()
            }}
            onBlur={() => setConfirmDelete(false)}
          >
            {t('common.confirm')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={t('common.remove')}
            onClick={() => (hasContent ? setConfirmDelete(true) : onRemove())}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <CollapsibleContent className="space-y-3 border-t px-3 py-3">
        <div className="space-y-1.5">
          <Label>{t('objects.propertyEditor.name')}</Label>
          <div className="flex items-center gap-2">
            {/* One field, attach button inside (same pattern as the value field). */}
            <div className="flex flex-1 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <PropertyNameCombobox
                ref={nameRef}
                className="h-8 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
              <button
                type="button"
                onClick={() => setModalTarget({ kind: 'property' })}
                title={t('objects.files.attach')}
                aria-label={t('objects.files.attach')}
                className="flex h-8 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>
          </div>
          <FilesDisclosure
            files={propFiles}
            editing
            entityId={entityId}
            onRemove={(localId) =>
              removeFile(`properties.${index}.files`, localId)
            }
            onChange={onFileChange}
          />
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
              const valueFiles = value?.files ?? []

              // Loaded derived values render read-only until the provenance editor lands (phase 2).
              if (existingDerived) {
                return (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span>{value?.data || '—'}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {t('objects.propertyEditor.derived')}
                      </Badge>
                    </div>
                    <FilesDisclosure
                      files={valueFiles}
                      editing={false}
                      entityId={entityId}
                    />
                  </div>
                )
              }

              const toggleLabel = isFormula
                ? t('objects.formulaEditor.switchToText')
                : t('objects.formulaEditor.switchToFormula')

              return (
                <div key={field.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {/* One field, attach + mode-switch buttons inside (currency-selector pattern). */}
                    <div className="flex flex-1 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                      {isFormula ? (
                        <FormulaSelect
                          className="h-8 flex-1 border-0 shadow-none focus:ring-0 focus:ring-offset-0"
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
                          className="h-8 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                          placeholder={valuePlaceholder}
                          {...form.register(`${base}.data`)}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setModalTarget({ kind: 'value', vIndex })
                        }
                        title={t('objects.files.attach')}
                        aria-label={t('objects.files.attach')}
                        className="flex h-8 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
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
                          'flex h-8 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground',
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
                      className="h-8 w-8 shrink-0"
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
                        form.setValue(`${base}.calc`, calc, {
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                  <FilesDisclosure
                    files={valueFiles}
                    editing
                    entityId={entityId}
                    onRemove={(localId) => removeFile(`${base}.files`, localId)}
                    onChange={onFileChange}
                  />
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
      </CollapsibleContent>

      <AttachmentModal
        open={modalTarget !== null}
        onOpenChange={(next) => !next && setModalTarget(null)}
        onAdd={addFiles}
      />
    </Collapsible>
  )
}
