'use client'

import { useEffect, useState } from 'react'
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
import { PropertyField } from '@/components/forms'
import { objectSchema, ObjectFormValues } from '@/lib/validations/object-model'
import {
  AttachmentList,
  AttachmentModal,
  ParentSelector,
  ModelSelector,
  ModelOption,
} from './components'
import { useObjectOperations } from './hooks'
import { createEmptyProperty } from './utils'

interface ObjectAddSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (object: any) => void
}

export function ObjectAddSheet({
  isOpen,
  onClose,
  onSave,
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

  // Watch address field for display
  const watchedAddress = form.watch('address')

  // Watch parent objects field
  const watchedParents = form.watch('parents') || []

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: '',
        abbreviation: '',
        version: '',
        description: '',
        parents: [],
        properties: [],
        files: [],
        isTemplate: false,
        modelUuid: undefined,
      })
      setSelectedModel(null) // Reset model selection
    }
  }, [isOpen, form])

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

  const addProperty = () => {
    append(createEmptyProperty())
  }

  const handleParentsChange = (parentUuids: string[]) => {
    form.setValue('parents', parentUuids)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
                        <FormLabel>{t('objects.fields.description')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('objects.placeholders.description')}
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
                    />
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter className="border-t pt-4">
              <div className="flex flex-col-reverse sm:flex-row w-full justify-between items-center gap-2">
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={onClose}
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
  )
}
