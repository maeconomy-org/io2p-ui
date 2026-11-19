import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { MAX_DESCRIPTION_CHARS } from '@/constants'
import { descriptionTooLong, type EntityDraft } from '@/lib/entity'

const DESCRIPTION_TOO_LONG = 'common.descriptionTooLong'

/**
 * Refuses a save that would send a description over the limit, before the node answers 400. Only a
 * create or an edited description is sent, so an old long one that nobody touched still saves.
 */
export function refuseLongDescription(
  form: UseFormReturn<EntityDraft>,
  draft: EntityDraft,
  creating: boolean,
  t: (key: string, values: { max: number }) => string
): boolean {
  const sent = creating || form.getFieldState('description').isDirty
  if (!descriptionTooLong(draft.description, sent)) return false
  form.setError(
    'description',
    { type: 'maxLength', message: DESCRIPTION_TOO_LONG },
    { shouldFocus: true }
  )
  toast.error(t(DESCRIPTION_TOO_LONG, { max: MAX_DESCRIPTION_CHARS }))
  return true
}
