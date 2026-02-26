'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'

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
import { PropertyField } from '@/components/properties'
import { objectSchema, ObjectFormValues } from '@/lib/validations/object-model'
import {
  AttachmentList,
  AttachmentModal,
  ParentSelector,
  ModelSelector,
  ModelOption,
  UnsavedChangesDialog,
} from './components'
import { useObjectOperations } from './hooks'
import { createEmptyProperty } from './utils'

interface ObjectAddSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (object: any) => void
  defaultParentUuids?: string[]
}

export function ObjectAddSheet({
  isOpen,
  onClose,
  onSave,
  defaultParentUuids,
}: ObjectAddSheetProps) {
  const t = useTranslations()
  const { createObject, isCreating } = useObjectOperations({
    isEditing: false,
    onRefetch: onSave ? () => onSave({}) : undefined, // Wrap onSave to match signature
  })

  const form = useForm<ObjectFormValues>({
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
  const watchedParents = form.watch('parents') || []

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
            uuid: `prop-${i}::${vIdx}`,
            key: p.key,
            label: p.key,
            value: v?.value || '',
            valueIndex: vIdx,
          })
        })
      })
    return result
  }, [propertiesKey, watchedProperties])

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      form.reset(defaultFormValues as any)
      setSelectedModel(null)
    }
  }, [isOpen, form, defaultFormValues])

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
    const success = await createObject(values)

    if (success) {
      onClose()
      form.reset()
    }
  }

  // Intercept close attempts and show dialog if there are unsaved changes
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedDialog(false)
    form.reset()
    onClose()
  }, [form, onClose])

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
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <Form {...form}>
            <SheetHeader>
              <SheetTitle>{t('objects.addTitle')}</SheetTitle>
              <SheetDescription>{t('objects.addDescription')}</SheetDescription>
            </SheetHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="space-y-4 pt-6 pb-2">
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
                      <PropertyField
                        key={field.id || `property-${index}`}
                        control={form.control}
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

              <SheetFooter className="border-t pt-4">
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
                        {t('objects.creating')}
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
      />
    </>
  )
}
