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
      data: undefined,
      isLoading: true,
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
})
