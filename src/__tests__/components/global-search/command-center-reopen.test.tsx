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

  it.each([
    'deleted:yes',
    'template:maybe',
    'parent:abc',
    'created:2026-02-30',
  ])(
    'shows %s as typed on its pill: a filter that cannot apply has no label',
    (query) => {
      render(<CommandCenter open onOpenChange={vi.fn()} initialQuery={query} />)
      expect(
        screen.getByRole('button', { name: `search.pill.remove ${query}` })
      ).toBeInTheDocument()
    }
  )

  it('says under the pills why a filter cannot apply, and the input points at it', () => {
    render(<CommandCenter open onOpenChange={vi.fn()} initialQuery="mass:2" />)
    const note = screen.getByTestId('command-center-problems')
    expect(note).toHaveTextContent('search.notAppliedBecause')
    const input = screen.getByPlaceholderText('commandCenter.placeholder')
    expect(input.getAttribute('aria-describedby')).toContain(note.id)
  })

  it('shows no problem note for a filter that applies', () => {
    render(<CommandCenter open onOpenChange={vi.fn()} initialQuery="mass>=2" />)
    expect(screen.queryByTestId('command-center-problems')).toBeNull()
  })
})
