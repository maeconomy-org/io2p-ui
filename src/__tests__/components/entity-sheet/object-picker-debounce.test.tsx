import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { ObjectPicker } from '@/components/entity-sheet/fields/object-picker'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const { useList } = vi.hoisted(() => ({
  useList: vi.fn((_query: { q?: string }) => ({
    data: { data: [], page: { totalElements: 0 } },
    isFetching: false,
  })),
}))

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({ useList }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

beforeEach(() => {
  vi.useFakeTimers()
  useList.mockClear()
})
afterEach(() => vi.useRealTimers())

const searchedTerms = () =>
  new Set(useList.mock.calls.map(([query]) => query.q))

describe('ObjectPicker search', () => {
  it('asks once for the word, not once per key', () => {
    render(<ObjectPicker value="" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByTestId('object-picker'))
    const input = screen.getByTestId('object-picker-search')

    for (const value of ['s', 'st', 'ste', 'stee', 'steel']) {
      fireEvent.change(input, { target: { value } })
      act(() => vi.advanceTimersByTime(100))
    }
    act(() => vi.advanceTimersByTime(300))

    expect(searchedTerms()).toEqual(new Set([undefined, 'steel']))
  })
})
