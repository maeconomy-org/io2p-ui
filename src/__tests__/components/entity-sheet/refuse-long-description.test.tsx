import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import { MAX_DESCRIPTION_CHARS } from '@/constants'
import { refuseLongDescription } from '@/components/entity-sheet/hooks/refuse-long-description'
import type { EntityDraft } from '@/lib/entity'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

const t = (key: string) => key
const long = 'a'.repeat(MAX_DESCRIPTION_CHARS + 1)

function formWith(description: string | null) {
  return renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name: 'Wall A',
        description,
        address: null,
        parentIds: [],
        properties: [],
      },
    })
  ).result
}

describe('refuseLongDescription', () => {
  it('refuses a create with a long description and marks the field', () => {
    const form = formWith(long)
    let refused = false
    act(() => {
      refused = refuseLongDescription(
        form.current,
        form.current.getValues(),
        true,
        t
      )
    })
    expect(refused).toBe(true)
    expect(form.current.getFieldState('description').error?.message).toBe(
      'common.descriptionTooLong'
    )
    expect(toastError).toHaveBeenCalledWith('common.descriptionTooLong')
  })

  it('lets an edit save when nobody touched an old long description', () => {
    const form = formWith(long)
    expect(
      refuseLongDescription(form.current, form.current.getValues(), false, t)
    ).toBe(false)
  })

  it('refuses an edit that makes the description too long', () => {
    const form = formWith('short')
    act(() => form.current.setValue('description', long, { shouldDirty: true }))
    let refused = false
    act(() => {
      refused = refuseLongDescription(
        form.current,
        form.current.getValues(),
        false,
        t
      )
    })
    expect(refused).toBe(true)
  })

  it('lets a description at the limit save', () => {
    const form = formWith('a'.repeat(MAX_DESCRIPTION_CHARS))
    expect(
      refuseLongDescription(form.current, form.current.getValues(), true, t)
    ).toBe(false)
  })
})
