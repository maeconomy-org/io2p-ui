'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ChevronRight,
  FunctionSquare,
  Paperclip,
  Pencil,
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
import { useConstants } from '@/hooks/api/leaves'
import {
  getValuePlaceholder,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import {
  calcFromProvenance,
  type EntityDraft,
  type DraftValue,
  type DraftFile,
} from '@/lib/entity-body'

import {
  FormulaSelect,
  FormulaBindings,
  type FormulaSibling,
} from './formula-value-editor'
import { AttachmentModal, FilesDisclosure } from '../files'
import { DeletedRow } from './deleted-row'
import { PropertyReadView } from './property-read-view'
import { ValueNormalization, formulaBoundValueIds } from './value-normalization'
import {
  ValueProvenanceDisplay,
  labelForValueId,
  type DerivedValues,
} from './value-provenance'

interface PropertyFieldsProps {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  /**
   * Derived values on the loaded entity, keyed by value id — read-only (editing is phase 2).
   * Presence means "derived"; the payload is the node's evaluation trace, absent on older writes.
   */
  derivedValues: DerivedValues
  entityId?: string
  /** Renders a header row (label + Add) instead of a trailing Add button — used by the create shell. */
  label?: string
  /**
   * False for entities io2p cannot attach files to (templates: the attach port routes through the
   * engine registry, which holds only objects and processes). Hides every file affordance rather
   * than offering one that silently drops what it is given.
   */
  allowFiles?: boolean
  /**
   * Where this property bag lives on the draft. Defaults to the entity's own `properties`; a process
   * FLOW passes its own path, which is how one editor serves objects, templates and flows instead of
   * a near-copy per container.
   */
  basePath?: PropertiesPath
  /**
   * False inside a process flow: the list/grid switch is a per-TAB preference, and one toggle per
   * flow row is the same control repeated down the page.
   */
  allowViewToggle?: boolean
  /**
   * Values a formula in this bag may bind to. Defaults to the bag itself. A process overrides it:
   * D76 makes calc siblings span the process's own properties AND every flow, so a flow's formula
   * can read a value from another flow.
   */
  siblingSource?: EntityDraft['properties']
}

/**
 * Every place a property bag can live on the draft. Written out rather than widened to `string` so
 * the nested `${basePath}.${index}.key` paths stay checked.
 */
export type PropertiesPath =
  | 'properties'
  | `inputs.${number}.properties`
  | `outputs.${number}.properties`

// A new value carries a client `ref` so a sibling formula can bind to it (calc arg -> ref).
function newValue(): DraftValue {
  return { data: '', ref: crypto.randomUUID() }
}

/**
 * Draft values a formula can bind to: key = existing id ?? client ref.
 *
 * Numeric values qualify, and so do EMPTY ones — a template preset applies with its values blank but
 * its formula already bound, and a binding whose target is absent from this list renders as unbound.
 * That made a correctly-applied template look like it had lost its mapping. Values holding actual
 * text stay excluded: a formula computes over numbers, and offering one would only produce NaN.
 */
function collectSiblings(
  properties: EntityDraft['properties'],
  selfKey: string | undefined
): FormulaSibling[] {
  const out: FormulaSibling[] = []
  properties.forEach((p) => {
    p.values.forEach((v) => {
      const key = v.id ?? v.ref
      if (!key || key === selfKey || v.calc || v.deleted) return // skip self + other formulas
      const text = (v.data ?? '').trim()
      const num = Number.parseFloat(text)
      if (text !== '' && !Number.isFinite(num)) return
      out.push({
        key,
        label: p.label || p.key || '—',
        num: Number.isFinite(num) ? num : undefined,
      })
    })
  })
  return out
}

export function PropertyFields({
  form,
  editing,
  derivedValues,
  entityId,
  label,
  allowFiles = true,
  allowViewToggle = true,
  basePath = 'properties',
  siblingSource,
}: PropertyFieldsProps) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: basePath,
  })

  // A trace names constants by id, but an editable recipe binds them by name. Only objects that
  // actually use one pay for the lookup — most formulas bind sibling values only.
  const usesConstants = useMemo(
    () =>
      [...derivedValues.values()].some((p) =>
        p?.args.some((a) => a.source.kind === 'constant')
      ),
    [derivedValues]
  )
  const { data: constants } = useConstants().useList(
    { page: 1, size: 200 },
    { enabled: editing && usesConstants }
  )
  const constantNames = useMemo(
    () => new Map((constants?.data ?? []).map((c) => [c.id, c.name])),
    [constants]
  )

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
      basePath,
      (form.getValues(basePath) ?? []).map((p) => ({
        ...p,
        files: apply(p.files),
        values: p.values.map((v) => ({ ...v, files: apply(v.files) })),
      })),
      { shouldDirty: options?.dirty ?? false }
    )
  }

  /**
   * Removing a STORED property marks it instead of dropping it, so Save sends a soft delete the
   * server can reverse and the row stays on screen struck-through with a Restore action. A row that
   * was never stored has nothing to preserve, so it just goes.
   */
  const removeProperty = (index: number) => {
    if (form.getValues(`${basePath}.${index}.id`)) {
      form.setValue(`${basePath}.${index}.deleted`, true, { shouldDirty: true })
    } else {
      remove(index)
    }
  }

  const restoreProperty = (index: number) =>
    form.setValue(`${basePath}.${index}.deleted`, false, { shouldDirty: true })

  if (!editing) {
    return (
      <PropertyReadView
        properties={form.watch(basePath) ?? []}
        derivedValues={derivedValues}
        entityId={entityId}
        onFileChange={patchFile}
        allowFiles={allowFiles}
        allowViewToggle={allowViewToggle}
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
          derivedValues={derivedValues}
          constantNames={constantNames}
          entityId={entityId}
          onFileChange={patchFile}
          onRemove={() => removeProperty(index)}
          onRestore={() => restoreProperty(index)}
          allowFiles={allowFiles}
          basePath={basePath}
          siblingSource={siblingSource}
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
  derivedValues,
  constantNames,
  entityId,
  onFileChange,
  onRemove,
  onRestore,
  allowFiles,
  basePath,
  siblingSource,
}: {
  form: UseFormReturn<EntityDraft>
  index: number
  derivedValues: DerivedValues
  constantNames: ReadonlyMap<string, string>
  entityId?: string
  onFileChange: (localId: string, patch: Partial<DraftFile>) => void
  onRemove: () => void
  onRestore: () => void
  allowFiles: boolean
  basePath: PropertiesPath
  siblingSource?: EntityDraft['properties']
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `${basePath}.${index}.values`,
  })
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // New properties (no key yet) open expanded to edit; loaded ones start collapsed to stay compact.
  const [isNew] = useState(() => !form.getValues(`${basePath}.${index}.key`))
  const [open, setOpen] = useState(isNew)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) nameRef.current?.focus()
  }, [isNew])

  /**
   * Leaving formula mode. For a value the server DERIVED, an explicit `null` is what reverts it to
   * authored — `undefined` means "no calc change", which would leave the server recomputing it. For
   * a value that was only ever a draft recipe there is nothing to revert, so undefined is right.
   */
  const clearedCalc = (valueId?: string) =>
    valueId && derivedValues.has(valueId) ? null : undefined

  const boundValueIds = useMemo(
    () => formulaBoundValueIds(derivedValues),
    [derivedValues]
  )

  const propKey = form.watch(`${basePath}.${index}.key`)
  const propLabel = form.watch(`${basePath}.${index}.label`)
  const propDeleted = form.watch(`${basePath}.${index}.deleted`) ?? false
  const valuePlaceholder =
    getValuePlaceholder(propKey, locale) ?? t('objects.propertyEditor.value')
  const ownProperties = form.watch(basePath) ?? []
  const propFiles = form.watch(`${basePath}.${index}.files`) ?? []
  const rowValues = ownProperties[index]?.values ?? []
  const fileTotal = allowFiles
    ? propFiles.length +
      rowValues.reduce((n, v) => n + (v.files?.length ?? 0), 0)
    : 0
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
        ? (`${basePath}.${index}.files` as const)
        : (`${basePath}.${index}.values.${modalTarget.vIndex}.files` as const)
    const current = form.getValues(path) ?? []
    form.setValue(path, [...current, ...files], { shouldDirty: true })
  }

  const removeFile = (
    path:
      | `${PropertiesPath}.${number}.files`
      | `${PropertiesPath}.${number}.values.${number}.files`,
    localId: string
  ) => {
    const current = form.getValues(path) ?? []
    form.setValue(
      path,
      current.filter((f) => f._localId !== localId),
      { shouldDirty: true }
    )
  }

  // A deleted property is shown, never hidden — but it can't be edited until it's restored, so the
  // whole editor collapses to the name plus a way back.
  if (propDeleted) {
    return (
      <DeletedRow
        label={propLabel || propKey || t('objects.propertyEditor.name')}
        onRestore={onRestore}
      />
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
                  form.setValue(`${basePath}.${index}.key`, key, {
                    shouldDirty: true,
                  })
                  form.setValue(`${basePath}.${index}.label`, label, {
                    shouldDirty: true,
                  })
                }}
              />
              {allowFiles && (
                <button
                  type="button"
                  onClick={() => setModalTarget({ kind: 'property' })}
                  title={t('objects.files.attach')}
                  aria-label={t('objects.files.attach')}
                  className="flex h-8 shrink-0 items-center border-l px-2.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {allowFiles && (
            <FilesDisclosure
              files={propFiles}
              editing
              entityId={entityId}
              onRemove={(localId) =>
                removeFile(`${basePath}.${index}.files`, localId)
              }
              onChange={onFileChange}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('objects.propertyEditor.value')}</Label>
          <div className="space-y-2">
            {fields.map((field, vIndex) => {
              const base = `${basePath}.${index}.values.${vIndex}` as const
              const value = form.watch(base)

              // Same rule as properties: a stored value is marked, a never-stored one just goes.
              if (value?.deleted) {
                return (
                  <DeletedRow
                    key={field.id}
                    label={value.data || t('objects.propertyEditor.value')}
                    onRestore={() =>
                      form.setValue(`${base}.deleted`, false, {
                        shouldDirty: true,
                      })
                    }
                  />
                )
              }

              const existingDerived =
                !!value?.id && derivedValues.has(value.id) && !value.calc
              const isFormula = !!value?.calc
              const selfKey = value?.id ?? value?.ref
              const valueFiles = value?.files ?? []

              /**
               * A derived value shows its result until you ask to change it. Editing hydrates the
               * recipe from the trace ON DEMAND rather than at load: putting `calc` into every
               * derived value up front would mark them all dirty and rebind on save, so an untouched
               * object would rewrite formulas it never touched.
               */
              if (existingDerived) {
                const provenance = derivedValues.get(value.id as string)
                const hydration = provenance
                  ? calcFromProvenance(provenance, constantNames)
                  : null
                return (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {value?.data || '—'}
                      </span>
                      {provenance ? (
                        <ValueProvenanceDisplay
                          provenance={provenance}
                          labelForValue={(id) =>
                            labelForValueId(siblingSource ?? ownProperties, id)
                          }
                        />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {t('objects.propertyEditor.derived')}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={!hydration?.ok}
                        aria-label={t('objects.formulaEditor.editFormula')}
                        title={
                          hydration?.ok || !hydration
                            ? t('objects.formulaEditor.editFormula')
                            : t(`objects.formulaEditor.${hydration.reason}`)
                        }
                        onClick={() =>
                          hydration?.ok &&
                          form.setValue(`${base}.calc`, hydration.calc, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={t('common.remove')}
                        onClick={() =>
                          form.setValue(`${base}.deleted`, true, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {allowFiles && (
                      <FilesDisclosure
                        files={valueFiles}
                        editing={false}
                        entityId={entityId}
                      />
                    )}
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
                      {allowFiles && (
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
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue(
                            `${base}.calc`,
                            isFormula ? clearedCalc(value?.id) : { args: [] },
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
                    {value && !isFormula && (
                      <ValueNormalization
                        value={value}
                        usedInFormula={
                          !!value.id && boundValueIds.has(value.id)
                        }
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={t('common.remove')}
                      onClick={() =>
                        value?.id
                          ? form.setValue(`${base}.deleted`, true, {
                              shouldDirty: true,
                            })
                          : remove(vIndex)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isFormula && value?.calc?.formulaId && (
                    <FormulaBindings
                      calc={value.calc}
                      siblings={collectSiblings(
                        siblingSource ?? ownProperties,
                        selfKey
                      )}
                      onChange={(calc) =>
                        form.setValue(`${base}.calc`, calc, {
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                  {allowFiles && (
                    <FilesDisclosure
                      files={valueFiles}
                      editing
                      entityId={entityId}
                      onRemove={(localId) =>
                        removeFile(`${base}.files`, localId)
                      }
                      onChange={onFileChange}
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
      </CollapsibleContent>

      {allowFiles && (
        <AttachmentModal
          open={modalTarget !== null}
          onOpenChange={(next) => !next && setModalTarget(null)}
          onAdd={addFiles}
        />
      )}
    </Collapsible>
  )
}
