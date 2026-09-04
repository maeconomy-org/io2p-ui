// The subject is which message the dialog picks and what count it carries — not the render.
//
// Delete is non-cascading, so the count is the whole subtree: dropping a node strands its
// grandchildren too, and `childCount` (direct children only) would understate that.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { ObjectListItem } from 'io2p-client'

const useSubtree = vi.fn()

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useSubtree }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const dialogProps = vi.fn()
vi.mock('@/components/dialogs', () => ({
  DeleteConfirmationDialog: (props: Record<string, unknown>) => {
    dialogProps(props)
    return null
  },
}))

import { DeleteObjectDialog } from '@/app/objects/components/delete-object-dialog'

const object = (over: Partial<ObjectListItem> = {}) =>
  ({ id: 'obj-1', name: 'Blok A', ...over }) as ObjectListItem

const page = (totalElements: number) => ({
  data: { page: { totalElements } },
  isPending: false,
})

function renderDialog(row: ObjectListItem) {
  render(
    <DeleteObjectDialog
      object={row}
      onOpenChange={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  return dialogProps.mock.calls.at(-1)![0] as { description: string }
}

describe('DeleteObjectDialog', () => {
  beforeEach(() => {
    dialogProps.mockClear()
    useSubtree.mockReset()
  })

  it('probes the subtree for a count without fetching the rows', () => {
    useSubtree.mockReturnValue(page(0))
    renderDialog(object())

    expect(useSubtree).toHaveBeenCalledWith('obj-1', {
      size: 1,
      refNames: false,
    })
  })

  it('names the descendant count when the object has a subtree', () => {
    useSubtree.mockReturnValue(page(214))
    const { description } = renderDialog(object({ childCount: 12 }))

    expect(description).toContain('deleteConfirmDescriptionWithChildren')
    expect(description).toContain('"count":214')
  })

  it('uses the plain copy for a leaf', () => {
    useSubtree.mockReturnValue(page(0))
    const { description } = renderDialog(object({ childCount: 0 }))

    expect(description).toContain('objects.deleteConfirmDescription:')
    expect(description).not.toContain('WithChildren')
  })

  it('uses the plain copy while the probe is in flight', () => {
    useSubtree.mockReturnValue({ data: undefined, isPending: true })
    const { description } = renderDialog(object({ childCount: 12 }))

    expect(description).not.toContain('WithChildren')
  })

  it('falls back to childCount when the ancestors index lags the write', () => {
    // `?ancestor=` is eventually consistent — a just-added child can be missing from the probe
    // while the row behind the dialog already shows it.
    useSubtree.mockReturnValue(page(0))
    const { description } = renderDialog(object({ childCount: 3 }))

    expect(description).toContain('deleteConfirmDescriptionWithChildren')
    expect(description).toContain('"count":3')
  })
})
