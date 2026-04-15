import * as z from 'zod'
import jsep from 'jsep'

export const formulaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  expression: z
    .string()
    .min(1, 'Expression is required')
    .refine(
      (val) => {
        try {
          jsep(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid formula syntax' }
    ),
  description: z.string().optional(),
  version: z.string().optional(),
})

export type FormulaFormValues = z.infer<typeof formulaSchema>
