import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

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

const qOf = () => useList.mock.calls.at(-1)?.[0].q
const pageOf = () => useList.mock.calls.at(-1)?.[0].page

const type = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText('objects.columnSearch'), {
    target: { value },
  })
  act(() => vi.advanceTimersByTime(300))
}

describe('columns view search', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useList.mockReturnValue({
      data: {
        data: [],
        page: { totalPages: 5, totalElements: 100, number: 1, size: 20 },
      },
      isLoading: false,
      isError: false,
    })
    render(
      <MillerColumn
        parentId=""
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
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('keeps the last q when the text grows past 8 words, and says why', () => {
    type('beton')
    expect(qOf()).toBe('beton')
    type('a1 b2 c3 d4 e5 f6 g7 h8 i9')
    expect(qOf()).toBe('beton')
    expect(screen.getByRole('status')).toHaveTextContent('maxWords')
  })

  it('sends no q when every word has one letter', () => {
    type('a b c')
    expect(qOf()).toBeUndefined()
    expect(screen.getByRole('status')).toHaveTextContent('minWordChars')
  })

  it('stays on its page when the search does not change', () => {
    type('beton')
    const pageInput = screen.getByDisplayValue('1')
    fireEvent.change(pageInput, { target: { value: '2' } })
    fireEvent.keyDown(pageInput, { key: 'Enter' })
    expect(pageOf()).toBe(2)
    type('beton ')
    expect(pageOf()).toBe(2)
    type('a1 b2 c3 d4 e5 f6 g7 h8 i9')
    expect(pageOf()).toBe(2)
    type('vloer')
    expect(pageOf()).toBe(1)
  })

  it('marks the search words in the names of the rows', () => {
    useList.mockReturnValue({
      data: {
        data: [{ id: 'o-1', name: 'Beton vloer', childCount: 0 }],
        page: { totalPages: 1, totalElements: 1, number: 1, size: 20 },
      },
      isLoading: false,
      isError: false,
    })
    type('vloer')
    expect(
      [...document.querySelectorAll('mark')].map((mark) => mark.textContent)
    ).toEqual(['vloer'])
  })

  it('says why a column could not load, with a retry', () => {
    const refetch = vi.fn()
    useList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 503 },
      refetch,
    })
    type('beton')
    expect(screen.getByTestId('list-error')).toHaveTextContent('listFailed')
    fireEvent.click(screen.getByRole('button', { name: 'listRetry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('keeps its rows when a refetch of them fails', () => {
    useList.mockReturnValue({
      data: {
        data: [{ id: 'o-1', name: 'Beton vloer', childCount: 0 }],
        page: { totalPages: 1, totalElements: 1, number: 1, size: 20 },
      },
      isLoading: false,
      isError: true,
      error: { status: 503 },
      refetch: vi.fn(),
    })
    type('beton')
    expect(screen.queryByTestId('list-error')).toBeNull()
    expect(screen.getByText('vloer', { exact: false })).toBeInTheDocument()
  })
})
