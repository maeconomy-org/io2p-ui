import * as z from 'zod'

export const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Name too long'),
})

export type GroupFormValues = z.infer<typeof groupSchema>
