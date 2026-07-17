import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'
import * as z from 'zod'
import { useQueryClient } from '@tanstack/react-query'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  Button,
} from '@/components/ui'
import {
  objectModelSchema,
  ObjectModelFormValues,
  Property,
  logger,
  queryKeys,
} from '@/lib'
import { PropertyItemRHF, usePropertyManagement } from '@/components/properties'
import { useObjects } from '@/hooks'
import { toast } from 'sonner'
import { useObjectOperations } from './hooks'
import { createEmptyProperty, diffTemplateProperties } from './utils'

interface ObjectModel {
  uuid?: string // Optional for new models
  name: string
  abbreviation: string
  version: string
  description: string
  creator: string
  createdAt: string
  updatedAt: string
  properties: Property[]
}

interface ObjectModelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (model: ObjectModel) => void
  model?: ObjectModel | null
  isEditing?: boolean
}

export function ObjectModelSheet({
  open,
  onOpenChange,
  onSave,
  model = null,
  isEditing = false,
}: ObjectModelSheetProps) {
  const t = useTranslations()
  const form = useForm<
    z.input<typeof objectModelSchema>,
    any,
    ObjectModelFormValues
  >({
    resolver: zodResolver(objectModelSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      version: '1.0',
      description: '',
      properties: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'properties',
  })

  // Use object operations hook for template creation/editing
  const { createObject, isCreating } = useObjectOperations({
    initialObject: model,
    isEditing,
    isTemplate: true, // This is always a template
    onRefetch: onSave ? () => onSave({} as any) : undefined,
  })

  // Direct update mutation for edit mode — bypasses saveMetadata, which depends
  // on `editedObject` state that's never populated for templates.
  const { useUpdateObjectMetadata } = useObjects()
  const updateMetadata = useUpdateObjectMetadata()

  const {
    createPropertyForObject,
    updatePropertyWithValues,
    removePropertyFromObject,
    softDeleteValue,
  } = usePropertyManagement()
  const queryClient = useQueryClient()

  // Initialize form when editing an existing model
  useEffect(() => {
    if (model && isEditing) {
      form.reset({
        name: model.name,
        abbreviation: model.abbreviation,
        version: model.version,
        description: model.description,
        properties: model.properties,
      })
    } else {
      form.reset({
        name: '',
        abbreviation: '',
        version: '1.0',
        description: '',
        properties: [],
      })
    }
  }, [model, isEditing, form])

  // Add a new property to the form
  const addProperty = () => {
    append(createEmptyProperty())
  }

  const persistPropertyChanges = async (
    templateUuid: string,
    initial: Property[],
    next: Property[]
  ): Promise<boolean> => {
    const { creates, updates, deletes, removedValueUuids } =
      diffTemplateProperties(initial, next)

    if (
      creates.length === 0 &&
      deletes.length === 0 &&
      updates.length === 0 &&
      removedValueUuids.length === 0
    ) {
      return false
    }

    await Promise.all([
      ...creates.map((p) =>
        createPropertyForObject(templateUuid, {
          key: p.key,
          label: p.label,
          type: p.type,
          values: p.values,
        })
      ),
      ...updates.map((p) =>
        updatePropertyWithValues(
          { uuid: p.uuid as string, key: p.key, label: p.label },
          p.values.map((v) => ({
            uuid: v.uuid,
            value: v.value,
            valueTypeCast: v.valueTypeCast,
          }))
        )
      ),
      ...deletes.map((p) =>
        removePropertyFromObject(
          templateUuid,
          p.uuid as string,
          (p.values || []).map((v) => v.uuid).filter((u): u is string => !!u)
        )
      ),
      ...removedValueUuids.map((uuid) => softDeleteValue(uuid)),
    ])

    return true
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

  // Handle form submission
  const onSubmit = async (values: ObjectModelFormValues) => {
    try {
      if (isEditing && model?.uuid) {
        const metadataChanged =
          values.name !== model.name ||
          values.abbreviation !== model.abbreviation ||
          values.version !== model.version ||
          values.description !== model.description
        if (metadataChanged) {
          await updateMetadata.mutateAsync({
            uuid: model.uuid,
            name: values.name,
            abbreviation: values.abbreviation,
            version: values.version,
            description: values.description,
            isTemplate: true,
          })
          toast.success(t('objects.objectMetadataUpdated'))
        }

        const propertiesChanged = await persistPropertyChanges(
          model.uuid,
          model.properties ?? [],
          values.properties
        )
        if (propertiesChanged) {
          queryClient.invalidateQueries({ queryKey: queryKeys.objects.all })
          queryClient.invalidateQueries({ queryKey: queryKeys.aggregates.all })
          toast.success(t('objects.propertiesUpdated'))
        }

        onOpenChange(false)
      } else {
        // For new templates, use createObject
        const { success } = await createObject(values)
        if (success) {
          onOpenChange(false)
          form.reset()
        }
      }
    } catch (error) {
      logger.error('Error saving template:', error)
      // Error is already handled by the hook with toast
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t('templates.editTitle') : t('templates.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t('templates.editDescription')
              : t('templates.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
            className="flex flex-col flex-1 overflow-hidden px-1 -mx-1"
          >
            <div className="flex-1 overflow-y-auto space-y-6 py-6 px-1 -mx-1">
              {/* Basic information */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('objects.fields.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('templates.placeholders.name')}
                          data-testid="model-name-input"
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
                              'templates.placeholders.abbreviation'
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
                            placeholder={t('templates.placeholders.version')}
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
                          placeholder={t('templates.placeholders.description')}
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Properties section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    {t('objects.fields.properties')}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addProperty}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('objects.addProperty')}
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <PropertyItemRHF
                    key={field.uuid !== '' ? field.uuid : index}
                    name={`properties.${index}`}
                    index={index}
                    onRemove={() => remove(index)}
                    templateMode
                  />
                ))}

                {fields.length === 0 && (
                  <div className="text-center p-4 border border-dashed rounded-md">
                    <p className="text-muted-foreground">
                      {t('objects.noProperties')}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={addProperty}
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      {t('templates.addFirstProperty')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with actions */}
            <SheetFooter className="flex gap-2 border-t pt-4 mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full"
                disabled={isCreating}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                    {isEditing
                      ? t('templates.updating')
                      : t('templates.creating')}
                  </>
                ) : isEditing ? (
                  t('templates.update')
                ) : (
                  t('templates.create')
                )}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
