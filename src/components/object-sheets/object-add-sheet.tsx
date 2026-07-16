'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { isDraftRef } from '@/lib/utils'
import { logger } from '@/lib'
import { useAuth } from '@/contexts'
import {
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  Textarea,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  HereAddressAutocomplete,
} from '@/components/ui'
import { PropertyItemRHF } from '@/components/properties'
import { objectSchema, ObjectFormValues } from '@/lib/validations/object-model'
import {
  AttachmentList,
  AttachmentModal,
  ParentSelector,
  ModelSelector,
  ModelOption,
  UnsavedChangesDialog,
} from './components'
import {
  useObjectOperations,
  useObjectDrafts,
  useFormDraftPersistence,
} from './hooks'
import { objectDraftsStore } from './hooks/use-object-drafts'
import {
  createEmptyProperty,
  resolveDraftParents,
  type ResolveDraftParentsError,
} from './utils'

interface ObjectAddSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (object: any) => void
  defaultParentUuids?: string[]
  /** When provided, the sheet opens with this draft loaded. */
  draftId?: string | null
  /**
   * When false, hides the "+ Create new parent" affordance in the parent
   * picker and disables nested sheet rendering. Used to enforce the
   * depth=1 invariant — a nested sheet must not itself nest.
   */
  allowInlineParent?: boolean
  /** Fires when this sheet successfully creates an object (real UUID). */
  onCreated?: (uuid: string) => void
  /** Fires when this sheet's content was persisted as a draft instead. */
  onSavedAsDraft?: (draftId: string) => void
}

export function ObjectAddSheet({
  isOpen,
  onClose,
  onSave,
  defaultParentUuids,
  draftId = null,
  allowInlineParent = true,
  onCreated,
  onSavedAsDraft,
}: ObjectAddSheetProps) {
  const t = useTranslations()
  const { userId } = useAuth()
  const { createObject, isCreating } = useObjectOperations({
    isEditing: false,
    onRefetch: onSave ? () => onSave({}) : undefined, // Wrap onSave to match signature
  })

  const form = useForm<z.input<typeof objectSchema>, any, ObjectFormValues>({
    resolver: zodResolver(objectSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      version: '',
      description: '',
      address: undefined,
      parents: [],
      properties: [],
      files: [],
      isTemplate: false,
      modelUuid: undefined,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'properties',
  })

  // Object-level attachments modal state
  const [isObjectAttachmentsOpen, setIsObjectAttachmentsOpen] = useState(false)

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null)

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const defaultFormValues = useMemo(
    () => ({
      name: '',
      abbreviation: '',
      version: '',
      description: '',
      address: undefined,
      parents: defaultParentUuids || [],
      properties: [],
      files: [],
      isTemplate: false,
      modelUuid: undefined,
    }),
    [defaultParentUuids]
  )

  const hasUnsavedChanges = useCallback((): boolean => {
    const values = form.getValues()
    const def = defaultFormValues as any
    const v = values as any
    if (v.name?.trim()) return true
    if (v.abbreviation?.trim()) return true
    if (v.version?.trim()) return true
    if (v.description?.trim()) return true
    if (v.address) return true
    if ((v.parents?.length ?? 0) !== (def.parents?.length ?? 0)) return true
    if ((v.properties?.length ?? 0) > 0) return true
    if ((v.files?.length ?? 0) > 0) return true
    return false
  }, [form, defaultFormValues])

  // Watch address field for display
  const watchedAddress = form.watch('address')

  // Watch parent objects field
  const watchedParents = (form.watch('parents') || []).filter(
    (p): p is string => !!p
  )

  // Watch properties to build available properties list for formula variable mapping
  // Use JSON.stringify to create a deep dependency that triggers on nested changes
  const watchedProperties = form.watch('properties') || []
  const propertiesKey = JSON.stringify(
    watchedProperties.map((p: any) => ({
      key: p?.key,
      values: p?.values?.map((v: any) => v?.value),
    }))
  )
  const availableProperties = useMemo(() => {
    const result: {
      uuid: string
      key: string
      label: string
      value: string
      valueIndex: number
    }[] = []
    watchedProperties
      .filter((p: any) => p?.key)
      .forEach((p: any, i: number) => {
        const values = p.values || []
        values.forEach((v: any, vIdx: number) => {
          if (!v?.value && v?._needsInput) return
          result.push({
            uuid: `prop-${i}::${vIdx}`, // index-based composite ID
            key: p.key,
            label: p.key,
            value: v?.value || '',
            valueIndex: vIdx,
          })
        })
      })
    return result
  }, [propertiesKey, watchedProperties])

  const { createDraftId, getDraft, deleteDraft } = useObjectDrafts()

  const { activeDraftId, clearDraft, pauseSaving, forceSaveDraft } =
    useFormDraftPersistence({
      form: form as any,
      draftId,
      isActive: isOpen,
      defaultValues: defaultFormValues as any,
      excludeFields: ['files'],
      onAllocateId: createDraftId,
      getDraftName: (v: any) => v?.name || '',
    })

  // Nested inline-parent sheet state (depth=1 invariant).
  const [inlineParentSheetOpen, setInlineParentSheetOpen] = useState(false)

  // Per-step submit progress when committing draft parents (>1).
  const [submitProgress, setSubmitProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  // Reset form when sheet opens — load draft if a draftId is provided.
  useEffect(() => {
    if (!isOpen) return
    if (draftId) {
      const stored = getDraft<typeof defaultFormValues>(draftId)
      if (stored) {
        form.reset({ ...defaultFormValues, ...stored } as any)
        setSelectedModel(null)
        return
      }
    }
    form.reset(defaultFormValues as any)
    setSelectedModel(null)
  }, [isOpen, draftId, form, defaultFormValues, getDraft])

  // Handle model selection and populate form with template data
  const handleModelSelect = (model: ModelOption | null) => {
    setSelectedModel(model)

    if (model) {
      // Pre-populate form with model data
      form.setValue('name', model.name || '')
      form.setValue('abbreviation', model.abbreviation || '')
      form.setValue('version', model.version || '')
      form.setValue('description', model.description || '')
      form.setValue('modelUuid', model.uuid)

      // Clear existing properties and add model properties
      form.setValue('properties', [])

      // Add model properties to the form
      if (model.properties && model.properties.length > 0) {
        const modelProperties = model.properties.map((prop: any) => ({
          key: prop.key || '',
          label: prop.label || prop.key || '',
          type: prop.type || 'string',
          values: prop.values?.map((val: any) => ({
            value: val.value || '',
            valueTypeCast: val.valueTypeCast || 'string',
            files: [],
          })) || [
            {
              value: '',
              valueTypeCast: 'string',
              files: [],
            },
          ],
          files: [],
        }))

        form.setValue('properties', modelProperties)
      }
    } else {
      form.setValue('modelUuid', undefined)
    }
  }

  const handleSubmit = async (values: ObjectFormValues) => {
    let resolvedParents: string[] = (values.parents || []).filter(
      (p): p is string => !!p
    )
    const hasDraftParents = resolvedParents.some(isDraftRef)

    if (hasDraftParents) {
      if (!userId) {
        toast.error(t('objects.parentCreationFailed', { name: '' }))
        return
      }
      try {
        resolvedParents = await resolveDraftParents(
          userId,
          resolvedParents,
          async (payload) => {
            const result = await createObject(payload as any)
            return { success: result.success, uuid: result.uuid }
          },
          (current, total) => {
            if (total > 1) setSubmitProgress({ current, total })
          }
        )
        // Sync resolver output back into the form so the next createObject
        // call (the actual child) sees real UUIDs, not draft refs.
        form.setValue('parents', resolvedParents, { shouldDirty: false })
      } catch (err) {
        const e = err as ResolveDraftParentsError
        const draftPayload = objectDraftsStore.get<{ name?: string }>(
          userId,
          e?.failedDraftId || ''
        )
        const failedName = draftPayload?.name || t('objects.drafts.untitled')
        toast.error(t('objects.parentCreationFailed', { name: failedName }))
        logger.error('Inline parent commit failed', e)
        setSubmitProgress(null)
        return
      }
    }

    const result = await createObject({
      ...values,
      parents: resolvedParents,
    } as any)
    setSubmitProgress(null)

    if (result.success) {
      clearDraft()
      if (result.uuid) onCreated?.(result.uuid)
      onClose()
      form.reset()
    }
  }

  const handleInvalidSubmit = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector(
        '[aria-invalid="true"]'
      ) as HTMLElement | null
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus?.()
    })
  }

  // Intercept close attempts. Always confirm when there are unsaved changes —
  // for the create flow the dialog also offers "Save as draft", for Add-Child
  // it's the legacy 2-button keep/discard prompt.
  const handleCloseAttempt = useCallback(() => {
    if (!hasUnsavedChanges()) {
      onClose()
      return
    }
    setShowUnsavedDialog(true)
  }, [hasUnsavedChanges, onClose])

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    pauseSaving()
    if (activeDraftId) {
      deleteDraft(activeDraftId)
    }
    form.reset()
    onClose()
  }, [pauseSaving, activeDraftId, deleteDraft, form, onClose])

  const handleSaveAsDraft = useCallback(() => {
    setShowUnsavedDialog(false)
    const savedId = forceSaveDraft()
    pauseSaving()
    if (savedId) onSavedAsDraft?.(savedId)
    onClose()
  }, [forceSaveDraft, pauseSaving, onSavedAsDraft, onClose])

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedDialog(false)
  }, [])

  const addProperty = () => {
    append(createEmptyProperty())
  }

  const handleParentsChange = (parentUuids: string[]) => {
    form.setValue('parents', parentUuids)
  }

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) =>
          !open && !showUnsavedDialog && handleCloseAttempt()
        }
      >
        <SheetContent className="sm:max-w-xl flex flex-col gap-y-0">
          <Form {...form}>
            <SheetHeader>
              <SheetTitle>{t('objects.addTitle')}</SheetTitle>
              <SheetDescription>{t('objects.addDescription')}</SheetDescription>
            </SheetHeader>
            <form
              onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
              className="flex flex-col flex-1 overflow-hidden px-1 -mx-1"
            >
              <div className="flex-1 overflow-y-auto space-y-4 pt-6 pb-2 px-1 -mx-1">
                <div className="space-y-2">
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelSelect={handleModelSelect}
                    placeholder={t('objects.modelTemplatePlaceholder')}
                    dataTour="object-model"
                  />

                  <ParentSelector
                    initialParentUuids={watchedParents}
                    onParentsChange={handleParentsChange}
                    placeholder={t('objects.parentSearch')}
                    maxSelections={10}
                    dataTour="object-parents"
                    allowInlineCreate={allowInlineParent}
                    onCreateInline={() => setInlineParentSheetOpen(true)}
                  />

                  <div className="space-y-2" data-tour="object-metadata">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('objects.fields.name')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('objects.placeholders.name')}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="abbreviation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t('objects.fields.abbreviation')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  'objects.placeholders.abbreviation'
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="version"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('objects.fields.version')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('objects.placeholders.version')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('objects.fields.description')}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t(
                                'objects.placeholders.description'
                              )}
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Address Section */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <FormLabel>{t('objects.fields.address')}</FormLabel>

                    <HereAddressAutocomplete
                      value={watchedAddress?.fullAddress || ''}
                      placeholder={t('objects.placeholders.address')}
                      onAddressSelect={(fullAddress, components) => {
                        form.setValue('address', { fullAddress, components })
                      }}
                      dataTour="object-address"
                    />
                  </div>

                  {watchedAddress?.components && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        📍 {watchedAddress.components.street}{' '}
                        {watchedAddress.components.houseNumber}
                      </div>
                      <div>
                        🏘️ {watchedAddress.components.city},{' '}
                        {watchedAddress.components.postalCode},{' '}
                        {watchedAddress.components.country}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Object-level attachments */}
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="files"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel>{t('objects.fields.files')}</FormLabel>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setIsObjectAttachmentsOpen(true)}
                            data-tour="object-files"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('objects.attachFile')}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <AttachmentList
                            attachments={field.value || []}
                            onRemoveAttachment={(att) => {
                              const currentAttachments = field.value || []
                              const attachmentIndex =
                                currentAttachments.findIndex(
                                  (a: any, index: number) =>
                                    a.fileName === att.fileName &&
                                    a.mode === att.mode &&
                                    index === currentAttachments.indexOf(att)
                                )
                              if (attachmentIndex >= 0) {
                                const next = [...currentAttachments]
                                next.splice(attachmentIndex, 1)
                                field.onChange(next)
                              }
                            }}
                            allowHardRemove={true}
                          />
                          <AttachmentModal
                            open={isObjectAttachmentsOpen}
                            onOpenChange={setIsObjectAttachmentsOpen}
                            attachments={field.value || []}
                            onChange={field.onChange}
                            title={t('objects.attachmentsTitle')}
                          />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <FormLabel>{t('objects.fields.properties')}</FormLabel>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={addProperty}
                      data-tour="add-property-button"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('objects.addProperty')}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <PropertyItemRHF
                        key={field.id || `property-${index}`}
                        name={`properties.${index}`}
                        index={index}
                        onRemove={() => remove(index)}
                        availableProperties={availableProperties.filter(
                          (p: any) => !p.uuid.startsWith(`prop-${index}::`)
                        )}
                      />
                    ))}

                    {/* Add Property button at the bottom for better UX */}
                    {fields.length > 0 && (
                      <div className="flex justify-center pt-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={addProperty}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t('objects.addAnotherProperty')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <SheetFooter className="border-t pt-4 mt-auto">
                <div className="flex flex-col-reverse sm:flex-row w-full justify-between items-center gap-2">
                  <Button
                    className="w-full"
                    type="button"
                    variant="outline"
                    onClick={handleCloseAttempt}
                    disabled={isCreating}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="w-full"
                    type="submit"
                    disabled={isCreating}
                    data-tour="object-create-submit"
                  >
                    {isCreating ? (
                      <>
                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                        {submitProgress
                          ? t('objects.creatingParents', {
                              current: submitProgress.current,
                              total: submitProgress.total,
                            })
                          : t('objects.creating')}
                      </>
                    ) : (
                      t('objects.create')
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onKeepEditing={handleKeepEditing}
        onSaveDraft={handleSaveAsDraft}
      />

      {allowInlineParent && (
        <ObjectAddSheet
          isOpen={inlineParentSheetOpen}
          onClose={() => setInlineParentSheetOpen(false)}
          allowInlineParent={false}
          onCreated={(newUuid) => {
            const current = form.getValues('parents') || []
            form.setValue('parents', [...current, newUuid])
            setInlineParentSheetOpen(false)
          }}
          onSavedAsDraft={(newDraftId) => {
            const current = form.getValues('parents') || []
            form.setValue('parents', [...current, newDraftId])
            setInlineParentSheetOpen(false)
          }}
        />
      )}
    </>
  )
}
