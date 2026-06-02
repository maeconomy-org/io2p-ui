'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Plus, Search, Trash2, Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Input,
  Label,
  Textarea,
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { PropertyItemRHF } from '@/components/properties'
import { useCommonApi } from '@/hooks/api'
import { cn, logger } from '@/lib'
import { processSchema, getQuantityWarnings } from '@/lib/validations/process'
import type { ProcessModel } from '@/types/process'

/** The model the sheet emits — identity is assigned by the create hook. */
export type ProcessModelInput = Omit<ProcessModel, 'processId'>

// --- RHF form shapes (values are {value} objects, as PropertyItemRHF expects) ---

interface RHFValue {
  value: string
  formulaData?: unknown
  files?: unknown[]
}
interface RHFProperty {
  key: string
  label?: string
  values: RHFValue[]
  files?: unknown[]
}
interface RHFMaterialProperty extends RHFProperty {
  isQuantity?: boolean
}
interface RHFMaterial {
  objectUuid: string
  objectName?: string
  properties: RHFMaterialProperty[]
}
interface ProcessFormShape {
  name: string
  type?: string
  description?: string
  properties: RHFProperty[]
  inputs: RHFMaterial[]
  outputs: RHFMaterial[]
}

const EMPTY_FORM: ProcessFormShape = {
  name: '',
  type: '',
  description: '',
  properties: [],
  inputs: [],
  outputs: [],
}

const newQuantityProperty = (): RHFMaterialProperty => ({
  key: 'quantity',
  label: 'Quantity',
  values: [{ value: '', files: [] }],
  files: [],
  isQuantity: true,
})

const newPlainProperty = (isQuantity = false): RHFMaterialProperty => ({
  key: '',
  label: '',
  values: [{ value: '', files: [] }],
  files: [],
  isQuantity,
})

interface ProcessCreateSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (model: ProcessModelInput) => void | Promise<void>
  isSaving?: boolean
}

export function ProcessCreateSheet({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: ProcessCreateSheetProps) {
  const t = useTranslations()
  const form = useForm<ProcessFormShape>({ defaultValues: EMPTY_FORM })
  const { control, register, handleSubmit, reset } = form

  useEffect(() => {
    if (isOpen) reset(EMPTY_FORM)
  }, [isOpen, reset])

  const processProps = useFieldArray({ control, name: 'properties' })
  const inputs = useFieldArray({ control, name: 'inputs' })
  const outputs = useFieldArray({ control, name: 'outputs' })

  const submit = handleSubmit((values) => {
    const model = toProcessModel(values)

    // The RHF value shape differs from the canonical schema, so map first then validate.
    const parsed = processSchema.safeParse(model)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      toast.error(first?.message ?? t('processes.create'))
      return
    }

    const warnings = getQuantityWarnings(model)
    if (warnings.length > 0) {
      toast.warning(
        t('processes.form.quantityWarning', { count: warnings.length })
      )
    }

    void onSave(model)
  })

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-2xl" side="right">
        <SheetHeader>
          <SheetTitle>{t('processes.form.createTitle')}</SheetTitle>
          <SheetDescription>{t('processes.form.subtitle')}</SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 flex-1">
              {/* px-1 keeps focus rings from being clipped by the scroll viewport */}
              <div className="space-y-6 px-1 py-2 pr-3">
                {/* Predefined fields */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="process-name">
                      {t('processes.form.nameLabel')}
                    </Label>
                    <Input
                      id="process-name"
                      placeholder={t('processes.form.namePlaceholder')}
                      {...register('name')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="process-description">
                      {t('processes.form.descriptionLabel')}
                    </Label>
                    <Textarea
                      id="process-description"
                      rows={2}
                      {...register('description')}
                    />
                  </div>
                </div>

                {/* Process-level properties (plain) */}
                <PropertySection
                  title={t('processes.form.properties')}
                  addLabel={t('processes.form.addProperty')}
                  emptyLabel={t('processes.form.noProperties')}
                  fields={processProps.fields}
                  onAdd={() => processProps.append(newPlainProperty())}
                  renderItem={(field, index) => (
                    <PropertyItemRHF
                      key={field.id}
                      name={`properties.${index}`}
                      index={index}
                      onRemove={() => processProps.remove(index)}
                      templateMode
                    />
                  )}
                />

                {/* Inputs / Outputs in tabs — cleaner with many materials */}
                <Tabs defaultValue="inputs" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="inputs">
                      {t('processes.form.inputs')} ({inputs.fields.length})
                    </TabsTrigger>
                    <TabsTrigger value="outputs">
                      {t('processes.form.outputs')} ({outputs.fields.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="inputs" className="mt-4">
                    <MaterialSection
                      side="input"
                      fields={inputs.fields}
                      onAddObject={(obj) =>
                        inputs.append({
                          objectUuid: obj.uuid,
                          objectName: obj.name,
                          properties: [newQuantityProperty()],
                        })
                      }
                      onRemove={(i) => inputs.remove(i)}
                    />
                  </TabsContent>
                  <TabsContent value="outputs" className="mt-4">
                    <MaterialSection
                      side="output"
                      fields={outputs.fields}
                      onAddObject={(obj) =>
                        outputs.append({
                          objectUuid: obj.uuid,
                          objectName: obj.name,
                          properties: [newQuantityProperty()],
                        })
                      }
                      onRemove={(i) => outputs.remove(i)}
                    />
                  </TabsContent>
                </Tabs>

                {/* Attachments (disabled for now) */}
                <div className="space-y-2 rounded-lg border border-dashed p-3 opacity-60">
                  <Label aria-disabled className="text-muted-foreground">
                    {t('processes.form.attachments')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('processes.form.attachmentsComingSoon')}
                  </p>
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="mt-auto gap-2 border-t pt-4">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t('processes.form.createButton')}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  )
}

// --- helpers ----------------------------------------------------------------

/** label -> code key (e.g. "Net Weight" -> "net_weight"). */
export function slugifyKey(label: string): string {
  return (label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const valueStrings = (vals?: RHFValue[]) =>
  (vals ?? []).map((v) => v.value ?? '')

/** A row the user added but never filled (no name, no label, no value) — dropped on save. */
const isEmptyProperty = (p: RHFProperty) =>
  !p.key?.trim() &&
  !p.label?.trim() &&
  valueStrings(p.values).every((v) => !v.trim())

function normalizeProp(p: RHFProperty) {
  const label = (p.label?.trim() || p.key?.trim() || '').trim()
  const key = (p.key?.trim() || slugifyKey(label)).trim()
  return { key, label: label || key, values: valueStrings(p.values) }
}

export function toProcessModel(values: ProcessFormShape): ProcessModelInput {
  const mapProps = (props?: RHFProperty[]) =>
    (props ?? []).filter((p) => !isEmptyProperty(p)).map(normalizeProp)
  const mapMaterial = (m: RHFMaterial) => ({
    objectUuid: m.objectUuid,
    objectName: m.objectName,
    properties: (m.properties ?? [])
      .filter((p) => !isEmptyProperty(p))
      .map((p) => ({ ...normalizeProp(p), isQuantity: !!p.isQuantity })),
  })

  return {
    name: values.name?.trim() ?? '',
    type: values.type?.trim() || undefined,
    description: values.description?.trim() || undefined,
    properties: mapProps(values.properties),
    inputs: (values.inputs ?? []).map(mapMaterial),
    outputs: (values.outputs ?? []).map(mapMaterial),
  }
}

// --- sub-sections -----------------------------------------------------------

function PropertySection({
  title,
  addLabel,
  emptyLabel,
  fields,
  onAdd,
  renderItem,
}: {
  title: string
  addLabel: string
  emptyLabel: string
  fields: { id: string }[]
  onAdd: () => void
  renderItem: (field: { id: string }, index: number) => React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">{fields.map(renderItem)}</div>
      )}
    </div>
  )
}

function MaterialSection({
  side,
  fields,
  onAddObject,
  onRemove,
}: {
  side: 'input' | 'output'
  fields: { id: string }[]
  onAddObject: (obj: { uuid: string; name: string }) => void
  onRemove: (index: number) => void
}) {
  const t = useTranslations()
  return (
    <div className="space-y-3">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <MaterialCard
            key={field.id}
            side={side}
            index={index}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
      <ObjectSearchAdd onPick={onAddObject} side={side} />
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {side === 'input'
            ? t('processes.form.noInputs')
            : t('processes.form.noOutputs')}
        </p>
      )}
    </div>
  )
}

function MaterialCard({
  side,
  index,
  onRemove,
}: {
  side: 'input' | 'output'
  index: number
  onRemove: () => void
}) {
  const t = useTranslations()
  const { control, watch, setValue } = useFormContext<ProcessFormShape>()
  const base = `${side}s.${index}` as const
  const objectName = watch(`${base}.objectName`)
  const props = useFieldArray({ control, name: `${base}.properties` })

  // Watch the live properties so the quantity selector reflects names as they're typed.
  const watchedProps = watch(`${base}.properties`) ?? []
  const quantityIndex = watchedProps.findIndex((p) => p?.isQuantity)
  const NONE = '__none__'

  // Exactly one property per material may be the quantity.
  const selectQuantity = (value: string) => {
    const target = value === NONE ? -1 : Number(value)
    props.fields.forEach((_, j) =>
      setValue(`${base}.properties.${j}.isQuantity`, j === target, {
        shouldDirty: true,
      })
    )
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Package className="h-4 w-4 text-muted-foreground" />
          {objectName || t('processes.form.selectedObject')}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('processes.form.removeMaterial')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Quantity selector — under the object name; which property drives the flow charts */}
      {props.fields.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            {t('processes.form.quantityField')}
          </Label>
          <Select
            value={quantityIndex >= 0 ? String(quantityIndex) : NONE}
            onValueChange={selectQuantity}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                {t('processes.form.quantityNone')}
              </SelectItem>
              {watchedProps.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p?.label?.trim() ||
                    p?.key?.trim() ||
                    t('processes.form.unnamedProperty', { n: i + 1 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {props.fields.map((field, pIndex) => (
          <PropertyItemRHF
            key={field.id}
            name={`${base}.properties.${pIndex}`}
            index={pIndex}
            onRemove={() => props.remove(pIndex)}
            templateMode
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => props.append(newPlainProperty(false))}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('processes.form.addProperty')}
        </Button>
      </div>
    </div>
  )
}

/** Inline debounced object search; clicking a result adds it as a material. */
function ObjectSearchAdd({
  onPick,
  side,
}: {
  onPick: (obj: { uuid: string; name: string }) => void
  side: 'input' | 'output'
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<{ uuid: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const { useSearch } = useCommonApi()
  const searchMutation = useSearch()
  const runRef = useRef(searchMutation)
  runRef.current = searchMutation

  const doSearch = useCallback(async (value: string) => {
    setSearching(true)
    try {
      const res = await runRef.current.mutateAsync({
        searchTerm: value,
        size: 25,
        page: 0,
      })
      setResults(
        (res?.content ?? [])
          .filter((o): o is { uuid: string; name?: string } => !!o.uuid)
          .map((o) => ({ uuid: o.uuid, name: o.name ?? o.uuid }))
      )
    } catch (error) {
      logger.error('Object search failed', { error })
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    const id = setTimeout(() => doSearch(term.trim()), 300)
    return () => clearTimeout(id)
  }, [term, open, doSearch])

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        {side === 'input'
          ? t('processes.form.addInput')
          : t('processes.form.addOutput')}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('processes.form.searchObjects')}
          className="pl-10"
        />
      </div>
      <div className="max-h-40 overflow-auto rounded border">
        {searching ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {t('objectSelection.searching')}
          </div>
        ) : results.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {t('processes.form.searchHint')}
          </div>
        ) : (
          <div className="space-y-1 p-1">
            {results.map((obj) => (
              <button
                key={obj.uuid}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60'
                )}
                onClick={() => {
                  onPick(obj)
                  setOpen(false)
                  setTerm('')
                  setResults([])
                }}
              >
                <span className="font-medium">{obj.name}</span>
                <span className="text-xs text-muted-foreground">
                  {obj.uuid.slice(-8)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false)
          setTerm('')
        }}
      >
        {t('common.cancel')}
      </Button>
    </div>
  )
}

export default ProcessCreateSheet
