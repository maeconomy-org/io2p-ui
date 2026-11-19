import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/hooks/api/leaves', () => ({ useUnits: () => ({ data: undefined }) }))
vi.mock('next-intl', () => ({
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

const input = () =>
  screen.getByPlaceholderText('commandCenter.placeholder') as HTMLInputElement

describe('CommandCenter reopened', () => {
  it('starts empty after a search was run and then cleared', () => {
    const { rerender } = render(
      <CommandCenter open onOpenChange={vi.fn()} initialQuery="" />
    )
    fireEvent.change(input(), { target: { value: 'mixing' } })

    // Enter ran the search, then the navbar X cleared it: no active search again.
    rerender(
      <CommandCenter open={false} onOpenChange={vi.fn()} initialQuery="" />
    )
    rerender(<CommandCenter open onOpenChange={vi.fn()} initialQuery="" />)

    expect(input().value).toBe('')
  })

  it('opens on the active search', () => {
    const { rerender } = render(
      <CommandCenter open={false} onOpenChange={vi.fn()} initialQuery="" />
    )
    rerender(
      <CommandCenter open onOpenChange={vi.fn()} initialQuery="mixing" />
    )

    expect(input().value).toBe('mixing')
  })
})
