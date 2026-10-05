import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import { setCalc } from '@/components/entity-sheet/fields/property-fields'
import type { EntityDraft } from '@/lib/entity'

const PATH = 'properties.0.values.0.calc' as const

function setup(
  calc: NonNullable<EntityDraft['properties'][number]['values'][number]['calc']>
) {
  const { result } = renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name: 'Battery',
        description: '',
        parentIds: [],
        properties: [{ key: 'energy', values: [{ id: 'v-energy', data: '' }] }],
      },
    })
  )
  act(() => setCalc(result.current, PATH, calc))
  return result
}

describe('setCalc', () => {
  it('moves a variable from one value to another', () => {
    const form = setup({
      formulaId: 'f',
      args: [{ var: 'a', ref: 'v-voltage' }],
    })

    act(() =>
      setCalc(form.current, PATH, {
        formulaId: 'f',
        args: [{ var: 'a', ref: 'v-capacity' }],
      })
    )

    expect(form.current.getValues(PATH)?.args).toEqual([
      { var: 'a', ref: 'v-capacity' },
    ])
  })

  it('moves the last of two variables without touching the first', () => {
    const form = setup({
      formulaId: 'f',
      args: [
        { var: 'a', ref: 'v-voltage' },
        { var: 'b', ref: 'v-capacity' },
      ],
    })

    act(() =>
      setCalc(form.current, PATH, {
        formulaId: 'f',
        args: [
          { var: 'a', ref: 'v-voltage' },
          { var: 'b', ref: 'v-energy' },
        ],
      })
    )

    expect(form.current.getValues(PATH)?.args).toEqual([
      { var: 'a', ref: 'v-voltage' },
      { var: 'b', ref: 'v-energy' },
    ])
  })

  it('replaces a value binding with a constant', () => {
    const form = setup({
      formulaId: 'f',
      args: [{ var: 'a', ref: 'v-voltage' }],
    })

    act(() =>
      setCalc(form.current, PATH, {
        formulaId: 'f',
        args: [{ var: 'a', constantId: 'c-kilo' }],
      })
    )

    expect(form.current.getValues(PATH)?.args).toEqual([
      { var: 'a', constantId: 'c-kilo' },
    ])
  })
})
