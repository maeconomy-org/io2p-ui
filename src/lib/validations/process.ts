import * as z from 'zod'
import { optionalUuidSchema } from './object-model'
import { hasNumericValue } from '@/lib/units/parse-quantity'

/**
 * Validation for the process create/edit form. Mirrors the object-model schemas, with two
 * process-specific traits: input/output materials carry an `isQuantity` flag, and at least
 * one input and one output are required (a process is N×M `IS_INPUT_OF` edges, §4).
 *
 * Quantity values are NOT hard-validated — a quantity saves as whatever the user typed.
 * Use `getQuantityWarnings` for a soft, non-blocking warning when a flagged value has no
 * parseable number.
 */

// Process-level property: plain, no quantity flag
export const processPropertySchema = z.object({
  key: z.string().min(1, 'Property name is required'),
  label: z.string().min(1, 'Property label is required'),
  values: z.array(z.string()),
})

// Input/output material property: same, plus the quantity checkbox
export const materialPropertySchema = processPropertySchema.extend({
  isQuantity: z.boolean().optional().default(false),
})

export const processMaterialSchema = z.object({
  objectUuid: z.string().min(1, 'An object must be selected'),
  objectName: z.string().optional(),
  properties: z.array(materialPropertySchema),
})

export const processSchema = z.object({
  // generated client-side at save; optional at the form level
  processId: optionalUuidSchema,
  name: z
    .string()
    .min(1, 'Name is required')
    .refine((val) => val.trim().length > 0, {
      message: 'Name cannot contain only whitespace',
    }),
  type: z.string().optional(),
  description: z.string().optional(),
  properties: z.array(processPropertySchema),
  inputs: z
    .array(processMaterialSchema)
    .min(1, 'At least one input is required'),
  outputs: z
    .array(processMaterialSchema)
    .min(1, 'At least one output is required'),
})

export type ProcessFormValues = z.infer<typeof processSchema>
export type ProcessPropertyValues = z.infer<typeof processPropertySchema>
export type MaterialPropertyValues = z.infer<typeof materialPropertySchema>

export interface QuantityWarning {
  side: 'input' | 'output'
  objectUuid: string
  key: string
}

// Minimal structural shape getQuantityWarnings needs — `isQuantity` is optional here so a
// plain (non-quantity) property is accepted, unlike the Zod output type where .default(false)
// makes it required.
interface QuantityScanProperty {
  key: string
  values: string[]
  isQuantity?: boolean
}
interface QuantityScanMaterial {
  objectUuid: string
  properties: QuantityScanProperty[]
}

/**
 * Soft check: which quantity-flagged material properties have no parseable number?
 * Non-blocking — the form still submits; surface these as warnings, not errors.
 */
export function getQuantityWarnings(form: {
  inputs: QuantityScanMaterial[]
  outputs: QuantityScanMaterial[]
}): QuantityWarning[] {
  const warnings: QuantityWarning[] = []
  const scan = (
    side: 'input' | 'output',
    materials: QuantityScanMaterial[]
  ) => {
    for (const m of materials) {
      for (const p of m.properties) {
        if (p.isQuantity && !hasNumericValue(p.values[0])) {
          warnings.push({ side, objectUuid: m.objectUuid, key: p.key })
        }
      }
    }
  }
  scan('input', form.inputs)
  scan('output', form.outputs)
  return warnings
}
