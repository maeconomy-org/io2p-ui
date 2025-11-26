import { useEffect } from 'react'
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
import { objectModelSchema, ObjectModelFormValues, Property } from '@/lib'
import { PropertyFieldTemplate } from '@/components/forms'
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
      console.error('Error saving template:', error)
      // Error is already handled by the hook with toast
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit Model' : 'Create New Model'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update this model template and its properties.'
              : 'Create a new model template that can be used to generate objects.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-6"
          >
            {/* Basic information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. School Building" {...field} />
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
                      <FormLabel>Abbreviation</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SB (optional)" {...field} />
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
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1.0 (optional)" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the object model..."
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
                <h3 className="text-lg font-medium">Properties</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProperty}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Property
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
                    No properties added yet
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={addProperty}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add First Property
                  </Button>
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <SheetFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full"
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditing ? (
                  'Update Model'
                ) : (
                  'Create Model'
                )}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
