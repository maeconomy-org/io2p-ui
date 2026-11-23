import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/hooks/api/leaves', () => ({ useUnits: () => ({ data: undefined }) }))
vi.mock('next-intl', () => ({
  useFormatter: () => ({
    dateTime: (d: Date) => d.toISOString().slice(0, 10),
  }),
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

// The saved searches have their own test file; here the dialog needs only an empty list.
vi.mock('@/hooks/ui/use-saved-searches', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSavedSearches: () => ({
    ready: true,
    saved: [],
    unreadable: [],
    save: vi.fn(),
    remove: vi.fn(),
    pending: false,
  }),
}))

import { CommandCenter } from '@/components/global-search/command-center'

const NINE_WORDS = 'a1 b2 c3 d4 e5 f6 g7 h8 i9'

const input = () =>
  screen.getByPlaceholderText('commandCenter.placeholder') as HTMLInputElement

const renderCenter = (searchKind?: 'words' | 'substring') => {
  const onSearch = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <CommandCenter
      open
      onOpenChange={onOpenChange}
      onSearch={onSearch}
      initialQuery="beton"
      searchKind={searchKind}
    />
  )
  return { onSearch, onOpenChange }
}

const submit = (value: string) => {
  fireEvent.change(input(), { target: { value } })
  fireEvent.keyDown(input(), { key: 'Enter' })
}

describe('CommandCenter word limit', () => {
  it.each([
    ['9 words', NINE_WORDS],
    ['9 words beside a property filter', `prop:material=steel ${NINE_WORDS}`],
  ])('does not run %s, and stays open', (_, value) => {
    const { onSearch, onOpenChange } = renderCenter()
    submit(value)
    expect(onSearch).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('says why under the input', () => {
    renderCenter()
    fireEvent.change(input(), { target: { value: NINE_WORDS } })
    const hint = screen.getByRole('status')
    expect(hint).toHaveTextContent('maxWords')
    expect(input()).toHaveAttribute('aria-describedby', hint.id)
  })

  it('runs a search too short to filter, which shows the whole list', () => {
    const { onSearch } = renderCenter()
    submit('a b c')
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('runs 8 words', () => {
    const { onSearch } = renderCenter()
    submit('a1 b2 c3 d4 e5 f6 g7 h8')
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('runs 9 words on a substring list', () => {
    const { onSearch } = renderCenter('substring')
    submit(NINE_WORDS)
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('uses the word rule for a template: search started on a substring list', () => {
    const { onSearch } = renderCenter('substring')
    submit(`template:true ${NINE_WORDS}`)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('maxWords')
  })
})
