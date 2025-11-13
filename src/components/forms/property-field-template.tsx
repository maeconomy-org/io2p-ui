import {
  Control,
  Controller,
  useFieldArray,
  useFormContext,
} from 'react-hook-form'
import { PlusIcon, XIcon } from 'lucide-react'

import { useState } from 'react'
import {
  Button,
  Input,
  Label,
  FormItem,
  FormField,
  FormControl,
  FormMessage,
} from '@/components/ui'

interface PropertyFieldTemplateProps {
  control: Control<any>
  name: string
  index: number
  onRemove: () => void
}

export function PropertyFieldTemplate({
  control,
  name,
  index,
  onRemove,
}: PropertyFieldTemplateProps) {
  const { setValue, getValues } = useFormContext()
  const valuesName = `${name}.values`

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
      files: [], // Keep the structure but no file UI
    })
  }

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
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm">Property Values</Label>

        {valueFields.map((valueField, valueIndex) => (
          <div key={valueField.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <FormField
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
