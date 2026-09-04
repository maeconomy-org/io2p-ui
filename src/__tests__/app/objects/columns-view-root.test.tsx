// `rootId` is what lets /objects/[uuid] show the same miller view rooted at one
// object instead of the collection. `''` is the node's roots-only sentinel, so
// the assertions pin which parent the FIRST column asks for — the render says
// nothing about that.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'

type ColumnCapture = {
  parentId: string
  title: string
  onSelect: (item: { id: string; childCount?: number }) => void
}
const columnProps: ColumnCapture[] = []

vi.mock('@/app/objects/components/columns-view/components', () => ({
  MillerColumn: (props: ColumnCapture) => {
    columnProps.push(props)
    return null
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { ObjectColumnsView } from '@/app/objects/components/columns-view'

const actions = {
  onViewObject: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onShowQRCode: vi.fn(),
  onCreateTemplate: vi.fn(),
  onRestore: vi.fn(),
}

describe('ObjectColumnsView rooting', () => {
  beforeEach(() => {
    columnProps.length = 0
  })

  it('asks for roots when no rootId is given', () => {
    render(<ObjectColumnsView {...actions} />)
    expect(columnProps[0].parentId).toBe('')
  })

  it('asks for one object’s children when rooted at it', () => {
    render(<ObjectColumnsView rootId="obj-1" {...actions} />)
    expect(columnProps[0].parentId).toBe('obj-1')
  })

  it('names the first column after the root rather than "all objects"', () => {
    render(
      <ObjectColumnsView rootId="obj-1" rootLabel="Building A" {...actions} />
    )
    expect(columnProps[0].title).toBe('Building A')
  })

  it('falls back to the all-objects title without a rootLabel', () => {
    render(<ObjectColumnsView {...actions} />)
    expect(columnProps[0].title).toBe('objects.columnsView.allObjects')
  })

  it('drops columns opened under a previous root', () => {
    // Otherwise the old root's descendants render beside the new root's
    // children and look like they belong to it. The column must actually be
    // OPENED first — asserting over an untouched path passes either way.
    const { rerender } = render(
      <ObjectColumnsView rootId="obj-1" {...actions} />
    )
    act(() => {
      columnProps[0].onSelect({ id: 'child-1', childCount: 2 })
    })
    expect(columnProps.map((c) => c.parentId)).toContain('child-1')

    columnProps.length = 0
    rerender(<ObjectColumnsView rootId="obj-2" {...actions} />)
    expect(columnProps.map((c) => c.parentId)).toEqual(['obj-2'])
  })
})
