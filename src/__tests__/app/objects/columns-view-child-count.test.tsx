import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function renderColumn(onSelect = vi.fn()) {
  render(
    <MillerColumn
      parentId=""
      title="Objects"
      selectedId={null}
      scope="all"
      onSelect={onSelect}
      onViewObject={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onShowQRCode={vi.fn()}
      onCreateTemplate={vi.fn()}
      onRestore={vi.fn()}
    />
  )
}

const row = (name: string) =>
  screen.getByText(name).closest<HTMLElement>('.mb-1')!

describe('a column row and its child count', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows a capped count as more than 1,000', () => {
    answer([{ name: 'Big', childCount: 1001 }], 1)
    renderColumn()
    expect(
      within(row('Big')).getByTestId('child-count-badge')
    ).toHaveTextContent('totalMoreThan')
  })

  it('marks a row with no count as unknown, and as one that opens a column', () => {
    answer([{ name: 'Uncounted' }], 1)
    renderColumn()
    const r = row('Uncounted')
    expect(within(r).getByTestId('count-unavailable')).toBeInTheDocument()
    expect(within(r).queryByTestId('child-count-badge')).toBeNull()
    expect(within(r).getByTestId('opens-column')).toBeInTheDocument()
  })

  it('shows no count and no column mark on a leaf', () => {
    answer([{ name: 'Leaf', childCount: 0 }], 1)
    renderColumn()
    const r = row('Leaf')
    expect(within(r).queryByTestId('child-count-badge')).toBeNull()
    expect(within(r).queryByTestId('count-unavailable')).toBeNull()
    expect(within(r).queryByTestId('opens-column')).toBeNull()
  })
})

describe('a column whose total the node capped', () => {
  afterEach(() => vi.clearAllMocks())

  it('says more than 1,000 items, not "1001 columns"', () => {
    answer(
      Array.from({ length: 20 }, () => ({ childCount: 0 })),
      1001
    )
    renderColumn()
    expect(screen.getByText('objects.itemsCountMoreThan')).toBeInTheDocument()
    expect(screen.getByText('pagination.ofAtLeast')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pagination.next' })
    ).toBeEnabled()
  })

  it('keeps next on at a full page 51 of 51+', () => {
    answer(
      Array.from({ length: 20 }, () => ({ childCount: 0 })),
      1001
    )
    renderColumn()
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '51' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useList.mock.calls.at(-1)?.[0].page).toBe(51)
    expect(
      screen.getByRole('button', { name: 'pagination.next' })
    ).toBeEnabled()
  })

  it('names the exact item count up to 1,000', () => {
    answer([{ childCount: 0 }], 1)
    renderColumn()
    expect(screen.getByText('objects.itemsCount')).toBeInTheDocument()
  })
})

describe('paging a capped column', () => {
  afterEach(() => vi.clearAllMocks())

  const fullPage = Array.from({ length: 20 }, () => ({ childCount: 0 }))
  const askedPage = () => useList.mock.calls.at(-1)![0].page

  it('asks for one page per landed page, however fast next is pressed', () => {
    answer(fullPage, 1001)
    renderColumn()
    // keepPreviousData: page 1's rows stay on screen while page 2 loads.
    useList.mockReturnValue({
      ...useList.mock.results.at(-1)!.value,
      isPlaceholderData: true,
    })
    fireEvent.click(screen.getByLabelText('pagination.next'))
    fireEvent.click(screen.getByLabelText('pagination.next'))
    expect(askedPage()).toBe(2)
  })

  it('says there are no more rows on an empty page after the end', () => {
    answer(fullPage, 1001)
    renderColumn()
    answer([], 1001)
    fireEvent.click(screen.getByLabelText('pagination.next'))
    expect(askedPage()).toBe(2)
    expect(screen.getByText('pagination.noMoreRows')).toBeInTheDocument()
    expect(screen.queryByText('objects.noItemsColumn')).toBeNull()
  })
})

describe('a column row by keyboard', () => {
  afterEach(() => vi.clearAllMocks())

  it.each(['{Enter}', ' '])('selects the row with %s', async (key) => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    answer([{ name: 'Blok A', childCount: 2 }], 1)
    renderColumn(onSelect)

    const name = within(row('Blok A')).getByTestId('column-row')
    name.focus()
    await user.keyboard(key)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({ name: 'Blok A' })
  })

  it('names the row menu for a screen reader', () => {
    answer([{ name: 'Blok A', childCount: 0 }], 1)
    renderColumn()
    expect(
      within(row('Blok A')).getByRole('button', { name: 'common.actions' })
    ).toBeInTheDocument()
  })
})
