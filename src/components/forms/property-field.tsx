import { useState, useEffect } from 'react'

import {
  Control,
  Controller,
  useFieldArray,
} from 'react-hook-form'
import { PlusIcon, UploadIcon, XIcon } from 'lucide-react'

import {
  AttachmentModal,
  AttachmentList,
} from '@/components/object-sheets/components'
import {
  Button,
  Input,
  Label,
  FormItem,
  FormField,
  FormControl,
  FormMessage,
} from '@/components/ui'

interface PropertyFieldProps {
  control: Control<any>
  name: string
  index: number
  onRemove: () => void
}

export function PropertyField({
  control,
  name,
  index,
  onRemove,
}: PropertyFieldProps) {
  const valuesName = `${name}.values`
  const filesName = `${name}.files`

  const {
    fields: valueFields,
    append: appendValue,
    remove: removeValue,
  } = useFieldArray({
    control,
    name: valuesName,
  })

  const handleAddValue = () => {
    appendValue({
      value: '',
      formula: '',
      files: [],
    })
  }

  // Modal state: value-level tracks which index is open; property-level separate
  const [openValueIndex, setOpenValueIndex] = useState<number | null>(null)
  const [isPropertyFilesOpen, setIsPropertyFilesOpen] = useState(false)
  
  // Version counter to force re-rendering when array changes
  const [arrayVersion, setArrayVersion] = useState(0)
  
  // Force re-render when field array length changes
  useEffect(() => {
    setArrayVersion(prev => prev + 1)
  }, [valueFields.length])

  return (
    <div className="border rounded-md p-3 space-y-4">
      <div className="flex items-start justify-between">
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`property-${index}`} className="text-sm">
              Property Name
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRemove}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-between items-center gap-2">
            <FormField
              control={control}
              name={`${name}.key`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      id={`property-${index}`}
                      placeholder="e.g. Total Floors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPropertyFilesOpen(true)}
            >
              <UploadIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Controller
              control={control}
              name={filesName}
              render={({ field }) => (
                <div className="mt-1 space-y-2">
                  {(field.value?.length || 0) > 0 && (
                    <Label className="text-sm">Property Files</Label>
                  )}
                  <AttachmentList attachments={field.value || []} />
                  <AttachmentModal
                    open={isPropertyFilesOpen}
                    onOpenChange={setIsPropertyFilesOpen}
                    attachments={field.value || []}
                    onChange={field.onChange}
                    title="Property Attachments"
                  />
                </div>
              )}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm">Property Values</Label>

        {valueFields.map((valueField, valueIndex) => (
          <div key={valueField.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-between gap-2 w-full">
                <FormField
                  key={`${valueField.id}-${arrayVersion}`}
                  control={control}
                  name={`${valuesName}.${valueIndex}.value`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Enter property value" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenValueIndex(valueIndex)}
                >
                  <UploadIcon className="h-4 w-4" />
                </Button>
              </div>

              {valueFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeValue(valueIndex)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Controller
              key={`${valueField.id}-files-${arrayVersion}`}
              control={control}
              name={`${valuesName}.${valueIndex}.files`}
              render={({ field }) => (
                <div className="mt-2 space-y-2">
                  {(field.value?.length || 0) > 0 && (
                    <Label className="text-sm">Value Files</Label>
                  )}
                  <AttachmentList attachments={field.value || []} />
                  <AttachmentModal
                    open={openValueIndex === valueIndex}
                    onOpenChange={(open) =>
                      setOpenValueIndex(open ? valueIndex : null)
                    }
                    attachments={field.value || []}
                    onChange={field.onChange}
                    title="Value Attachments"
                  />
                </div>
              )}
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleAddValue}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Another Value
        </Button>
      </div>
    </div>
  )
}
