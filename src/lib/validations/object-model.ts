import * as z from 'zod'

export const propertyValueSchema = z.object({
  uuid: z.string().optional(),
  value: z.string().min(1, 'Value is required'),
  files: z.array(z.any()),
})

export const propertySchema = z.object({
  uuid: z.string().optional(),
  key: z.string().min(1, 'Property name is required'),
  values: z.array(propertyValueSchema),
  files: z.array(z.any()),
})

export const addressSchema = z.object({
  fullAddress: z.string().min(1, 'Full address is required'),
  components: z.object({
    street: z.string().optional(),
    houseNumber: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
  }),
})

export const objectModelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  properties: z.array(propertySchema),
})

export const objectSchema = z.object({
  uuid: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  address: addressSchema.optional(),
  parents: z.array(z.string()).optional(), // New field for multiple parents
  properties: z.array(propertySchema),
  files: z.array(z.any()).optional(),
  modelUuid: z.string().optional(),
  isTemplate: z.boolean().optional().default(false),
})

export type ObjectModelFormValues = z.infer<typeof objectModelSchema>
export type ObjectFormValues = z.infer<typeof objectSchema>
export type PropertyValue = z.infer<typeof propertyValueSchema>
export type Property = z.infer<typeof propertySchema>
