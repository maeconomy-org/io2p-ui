import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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
