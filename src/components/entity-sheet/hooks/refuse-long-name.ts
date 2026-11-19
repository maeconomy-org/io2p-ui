import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { MAX_NAME_CHARS } from '@/constants'
import type { EntityDraft } from '@/lib/entity'
import { charCount } from '@/lib/utils'

const NAME_TOO_LONG = 'common.nameTooLong'

/**
 * Refuses a save that would send a name over the limit, before the node answers 400 with its schema
 * text. Only a create or an edited name is sent, so an old long one that nobody touched still saves.
 */
export function refuseLongName(
  form: UseFormReturn<EntityDraft>,
  draft: EntityDraft,
  creating: boolean,
  t: (key: string, values: { max: number }) => string
): boolean {
  const sent = creating || form.getFieldState('name').isDirty
  if (!sent || charCount(draft.name) <= MAX_NAME_CHARS) return false
  form.setError(
    'name',
    { type: 'maxLength', message: NAME_TOO_LONG },
    { shouldFocus: true }
  )
  toast.error(t(NAME_TOO_LONG, { max: MAX_NAME_CHARS }))
  return true
}
