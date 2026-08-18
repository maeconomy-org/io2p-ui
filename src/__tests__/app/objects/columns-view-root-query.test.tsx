// Regression test for a filter that was being thrown away.
//
// `?parent=` with an EMPTY value means "roots only" to the node; a real id means "children of
// that id". The column view built its query as `parent: parentId || undefined`, which turns the
// first column's `''` into `undefined` — no filter at all — so column one listed every object at
// any depth. It looked plausible (rows appeared, paging worked) and the bug only showed as a
// child sitting beside its own parent.
//
// The assertions therefore pin the QUERY, not the render: the empty string has to survive.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const useList = vi.fn()

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useList }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}))

import { MillerColumn } from '@/app/objects/components/columns-view/components/object-column'

function renderColumn(parentId: string) {
  return render(
    <MillerColumn
      parentId={parentId}
      title="Objects"
      selectedId={null}
      scope="all"
      onSelect={vi.fn()}
      onViewObject={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onShowQRCode={vi.fn()}
      onCreateTemplate={vi.fn()}
      onRestore={vi.fn()}
    />
  )
}

const queryOf = () => useList.mock.calls.at(-1)?.[0]

describe('columns view — the root column asks for roots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
  })

  it('sends parent as an empty string for the first column', () => {
    renderColumn('')
    // Not `undefined`, and not absent — the empty string IS the filter.
    expect(queryOf()).toHaveProperty('parent', '')
  })

  it('sends the id for a child column', () => {
    renderColumn('obj-1')
    expect(queryOf()).toHaveProperty('parent', 'obj-1')
  })

  it('asks for child counts, which the expand affordance depends on', () => {
    renderColumn('')
    expect(queryOf()).toHaveProperty('withChildCounts', true)
  })
})
