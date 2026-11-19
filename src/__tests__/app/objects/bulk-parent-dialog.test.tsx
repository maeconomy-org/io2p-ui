import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ObjectListItem } from 'io2p-client'

import { BulkParentDialog } from '@/app/objects/components/bulk-parent-dialog'

const update = vi.fn().mockResolvedValue({})
const pickerProps = vi.fn()
const toastSuccess = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key} ${values.count}`,
}))

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useUpdate: () => ({ mutateAsync: update }) }),
}))

vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}))

vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

// The picker has its own tests; here it only has to hand back a chosen parent.
vi.mock('@/components/entity-sheet/fields/object-picker', () => ({
  ObjectPicker: (props: {
    onSelect: (id: string, name: string) => void
    requireLinkable?: boolean
  }) => {
    pickerProps(props)
    return (
      <button type="button" onClick={() => props.onSelect('a', 'Object a')}>
        pick a
      </button>
    )
  },
}))

const row = (id: string) => ({ id, name: `Object ${id}` }) as ObjectListItem

describe('BulkParentDialog', () => {
  beforeEach(() => {
    update.mockClear()
    toastSuccess.mockClear()
  })

  it('counts only the objects it really moved', async () => {
    render(
      <BulkParentDialog
        open
        onOpenChange={vi.fn()}
        objects={[row('a'), row('b')]}
        onDone={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('pick a'))
    fireEvent.click(screen.getByTestId('bulk-parent-save'))

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('objects.bulk.parentSet 1')
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      id: 'b',
      body: { parents: { add: ['a'] } },
    })
  })

  it('does not save when the only object is the chosen parent', () => {
    render(
      <BulkParentDialog
        open
        onOpenChange={vi.fn()}
        objects={[row('a')]}
        onDone={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('pick a'))

    expect(screen.getByTestId('bulk-parent-save')).toBeDisabled()
  })

  it('says how many selected objects it leaves out', () => {
    render(
      <BulkParentDialog
        open
        onOpenChange={vi.fn()}
        objects={[row('b')]}
        skippedCount={2}
        onDone={vi.fn()}
      />
    )

    expect(screen.getByTestId('bulk-parent-skips-unmovable')).toHaveTextContent(
      'objects.bulk.parentSkipsUnmovable 2'
    )
  })

  it('offers only parents the viewer may link under', () => {
    render(
      <BulkParentDialog
        open
        onOpenChange={vi.fn()}
        objects={[row('b')]}
        onDone={vi.fn()}
      />
    )

    expect(pickerProps).toHaveBeenCalledWith(
      expect.objectContaining({ requireLinkable: true })
    )
  })

  it('says nothing about skipping when every object can move', () => {
    render(
      <BulkParentDialog
        open
        onOpenChange={vi.fn()}
        objects={[row('b')]}
        onDone={vi.fn()}
      />
    )

    expect(screen.queryByTestId('bulk-parent-skips-unmovable')).toBeNull()
  })
})
