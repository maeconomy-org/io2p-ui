import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import en from '@/messages/en.json'

const hint = vi.hoisted(() => ({ read: false, markRead: vi.fn() }))

vi.mock('@/hooks/ui/use-preference', () => ({
  useFlagPreference: () => [hint.read, hint.markRead, true],
}))

import { UnitsHelp } from '@/components/entity-sheet/fields/units-help'

function renderHelp() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UnitsHelp />
    </NextIntlClientProvider>
  )
}

// The dialog loads on first open; warming the module keeps the tests about behaviour, not about
// how long a cold import takes on a busy machine.
beforeAll(async () => {
  await import('@/components/dialogs/formula-reference-dialog')
})

beforeEach(() => {
  hint.read = false
  hint.markRead.mockClear()
})

describe('UnitsHelp', () => {
  // A dialog, not a hover card: it opens on click, tap and Enter, and a screen reader announces it.
  it('opens the formula reference at its units section', async () => {
    renderHelp()
    fireEvent.click(screen.getByTestId('formula-units-help'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('formula-reference-units')).toBeInTheDocument()
  })

  it('marks it read once, however often it is opened', async () => {
    renderHelp()
    const button = screen.getByTestId('formula-units-help')
    fireEvent.click(button)
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(button)

    expect(hint.markRead).toHaveBeenCalledTimes(1)
  })

  // The dialog has no trigger of its own, so without this a keyboard user closing it lands on
  // <body> and loses their place in the sheet.
  it('returns focus to the button when the dialog closes', async () => {
    renderHelp()
    const button = screen.getByTestId('formula-units-help')
    fireEvent.click(button)
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(button).toHaveFocus())
  })

  it('shows the dot until read, and names it for a screen reader', () => {
    renderHelp()
    expect(screen.getByTestId('formula-units-help-unread')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /How units work — / })
    ).toBeInTheDocument()
  })

  it('writes nothing for a user who has already read it', () => {
    hint.read = true
    renderHelp()
    fireEvent.click(screen.getByTestId('formula-units-help'))

    expect(screen.queryByTestId('formula-units-help-unread')).toBeNull()
    expect(hint.markRead).not.toHaveBeenCalled()
  })
})
