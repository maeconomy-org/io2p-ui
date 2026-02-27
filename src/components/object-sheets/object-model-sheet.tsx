import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'

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
} from '@/lib'
import { PropertyFieldTemplate } from '@/components/properties'
import { useObjectOperations } from './hooks'
import { createEmptyProperty } from './utils'

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
  const form = useForm<ObjectModelFormValues>({
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
  const { createObject, saveMetadata, hasMetadataChanged, isCreating } =
    useObjectOperations({
      initialObject: model,
      isEditing,
      isTemplate: true, // This is always a template
      onRefetch: onSave ? () => onSave({} as any) : undefined,
    })

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

  // Handle form submission
  const onSubmit = async (values: ObjectModelFormValues) => {
    try {
      if (isEditing && model) {
        // For editing, use saveMetadata if there are changes
        if (hasMetadataChanged) {
          await saveMetadata()
        }
        // TODO: Handle property updates for existing templates
        onOpenChange(false)
      } else {
        // For new templates, use createObject
        const success = await createObject(values)
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
            {isEditing ? t('models.editTitle') : t('models.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t('models.editDescription')
              : t('models.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
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
                          placeholder={t('models.placeholders.name')}
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
                            placeholder={t('models.placeholders.abbreviation')}
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
                            placeholder={t('models.placeholders.version')}
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
                          placeholder={t('models.placeholders.description')}
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
                  <PropertyFieldTemplate
                    key={field.uuid !== '' ? field.uuid : index}
                    control={form.control}
                    name={`properties.${index}`}
                    index={index}
                    onRemove={() => remove(index)}
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
                      {t('models.addFirstProperty')}
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
                    {isEditing ? t('models.updating') : t('models.creating')}
                  </>
                ) : isEditing ? (
                  t('models.update')
                ) : (
                  t('models.create')
                )}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
