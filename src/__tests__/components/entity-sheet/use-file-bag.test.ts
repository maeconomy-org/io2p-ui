import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'

import {
  fileBagActions,
  useFileBag,
} from '@/components/entity-sheet/fields/use-file-bag'
import type { DraftFile, EntityDraft } from '@/lib/entity'

const file = (id: string, over: Partial<DraftFile> = {}): DraftFile => ({
  _localId: id,
  id,
  kind: 'reference',
  reference: { url: `https://example.org/${id}` },
  ...over,
})

function renderBag(files: DraftFile[] = []) {
  return renderHook(() => {
    const form = useForm<EntityDraft>({
      defaultValues: {
        name: 'Wall',
        description: null,
        address: null,
        parentIds: [],
        properties: [
          { id: 'p1', key: 'height', values: [{ id: 'v1', files: [] }] },
        ],
        files,
      },
    })
    // formState is a proxy: a field is only tracked if it is read during render.
    const { isDirty, dirtyFields } = form.formState
    return { form, isDirty, dirtyFields, bag: useFileBag(form, 'files') }
  })
}

describe('a file list on the draft', () => {
  it('adds after what is there, and marks the draft dirty', () => {
    const { result } = renderBag([file('a')])

    act(() => result.current.bag.add([file('b'), file('c')]))

    expect(result.current.bag.files.map((f) => f._localId)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(result.current.dirtyFields.files).toBeTruthy()
  })

  it('keeps both adds when two run before a re-render', () => {
    const { result } = renderBag()

    act(() => {
      result.current.bag.add([file('a')])
      result.current.bag.add([file('b')])
    })

    expect(result.current.bag.files.map((f) => f._localId)).toEqual(['a', 'b'])
  })

  it('removes one file by its local id', () => {
    const { result } = renderBag([file('a'), file('b')])

    act(() => result.current.bag.remove('a'))

    expect(result.current.bag.files.map((f) => f._localId)).toEqual(['b'])
  })

  it('patches a file the server already changed without marking the draft dirty', () => {
    const { result } = renderBag([file('a'), file('b')])

    act(() => result.current.bag.patch('a', { deleted: true }))

    expect(result.current.bag.files[0].deleted).toBe(true)
    expect(result.current.bag.files[1].deleted).toBeUndefined()
    expect(result.current.isDirty).toBe(false)
  })

  it('marks the draft dirty when the patch still needs saving', () => {
    const { result } = renderBag([file('a')])

    act(() => result.current.bag.patch('a', { label: 'x' }, { dirty: true }))

    expect(result.current.isDirty).toBe(true)
  })

  it('works on a value’s list too, from a plain call', () => {
    const { result } = renderBag()

    act(() =>
      fileBagActions(result.current.form, 'properties.0.values.0.files').add([
        file('v'),
      ])
    )

    expect(
      result.current.form.getValues('properties.0.values.0.files')
    ).toHaveLength(1)
  })
})
