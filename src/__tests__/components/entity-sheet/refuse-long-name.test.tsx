import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import { MAX_NAME_CHARS } from '@/constants'
import { refuseLongName } from '@/components/entity-sheet/hooks/refuse-long-name'
import type { EntityDraft } from '@/lib/entity'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

const t = (key: string) => key
const long = 'a'.repeat(MAX_NAME_CHARS + 1)

function formWith(name: string) {
  return renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name,
        description: null,
        address: null,
        parentIds: [],
        properties: [],
      },
    })
  ).result
}

describe('refuseLongName', () => {
  it('refuses a create with a name over the limit, before any request', () => {
    const form = formWith(long)
    let refused = false
    act(() => {
      refused = refuseLongName(form.current, form.current.getValues(), true, t)
    })
    expect(refused).toBe(true)
    expect(form.current.getFieldState('name').error?.message).toBe(
      'common.nameTooLong'
    )
    expect(toastError).toHaveBeenCalledWith('common.nameTooLong')
  })

  it('takes a name of exactly the limit, counted in characters, not UTF-16 units', () => {
    const form = formWith('😀'.repeat(MAX_NAME_CHARS))
    expect(
      refuseLongName(form.current, form.current.getValues(), true, t)
    ).toBe(false)
  })

  it('lets an edit save when nobody touched an old long name', () => {
    const form = formWith(long)
    expect(
      refuseLongName(form.current, form.current.getValues(), false, t)
    ).toBe(false)
  })

  it('refuses an edit that makes the name too long', () => {
    const form = formWith('short')
    act(() => form.current.setValue('name', long, { shouldDirty: true }))
    let refused = false
    act(() => {
      refused = refuseLongName(form.current, form.current.getValues(), false, t)
    })
    expect(refused).toBe(true)
  })
})
