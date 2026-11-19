import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ObjectListItem } from 'io2p-client'

const useList = vi.fn()

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useList }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: String, dateTime: () => '' }),
}))

import { MillerColumn } from '@/app/objects/components/columns-view/components/object-column'

/** A column page as the node sends it: 1001 when it capped the count. */
function answer(rows: Partial<ObjectListItem>[], totalElements: number) {
  useList.mockReturnValue({
    data: {
      data: rows.map((row, i) => ({ id: `o-${i}`, name: `Obj ${i}`, ...row })),
      page: {
        number: 1,
        size: 20,
        totalElements,
        totalPages: Math.ceil(totalElements / 20),
      },
    },
    isLoading: false,
    isError: false,
  })
}

function renderColumn(selectedId: string | null) {
  render(
    <MillerColumn
      parentId=""
      title="Objects"
      selectedId={selectedId}
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

const rowButton = (name: string) =>
  screen
    .getAllByTestId('column-row')
    .find((b) => b.textContent?.includes(name))!

describe('a column row tells a screen reader what it does', () => {
  afterEach(() => vi.clearAllMocks())

  it('says a row with children opens a column, and whether it is open', () => {
    answer(
      [
        { id: 'a', name: 'Has kids', childCount: 3 },
        { id: 'b', name: 'Other kids', childCount: 2 },
      ],
      2
    )
    renderColumn('a')
    expect(rowButton('Has kids')).toHaveAttribute('aria-expanded', 'true')
    expect(rowButton('Other kids')).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives a row with no children no expanded state', () => {
    answer([{ id: 'a', name: 'Leaf', childCount: 0 }], 1)
    renderColumn('a')
    expect(rowButton('Leaf')).not.toHaveAttribute('aria-expanded')
    expect(rowButton('Leaf')).toHaveAttribute('aria-current', 'true')
  })
})
