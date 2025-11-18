import * as z from 'zod'

export const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  type: z.enum(['public', 'private'], {
    required_error: 'Please select a group type',
  }),
  permissions: z
    .object({
      level: z.enum(['read', 'write']).default('read'),
    })
    .optional(),
})

export type GroupFormValues = z.infer<typeof groupSchema>
