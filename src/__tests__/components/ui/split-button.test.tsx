import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SplitButton } from '@/components/ui/split-button'

function renderSplit(overrides: Record<string, unknown> = {}) {
  const onClick = vi.fn()
  const onSelect = vi.fn()
  render(
    <SplitButton
      onClick={onClick}
      menuLabel="More actions"
      actions={[{ key: 'copy', label: 'Copy here', onSelect }]}
      {...overrides}
    >
      Add child
    </SplitButton>
  )
  return { onClick, onSelect }
}

describe('SplitButton', () => {
  it('runs the primary action when the label half is clicked', () => {
    const { onClick, onSelect } = renderSplit()

    fireEvent.click(screen.getByRole('button', { name: 'Add child' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does NOT run the primary action when the chevron is clicked', () => {
    // The whole point of the split: the chevron opens the menu, it does not
    // perform the default action on the way.
    const { onClick } = renderSplit()

    fireEvent.click(screen.getByTestId('split-button-trigger'))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('gives the chevron its own accessible name', () => {
    // It has no text, so without this it announces as an unnamed button and the
    // secondary actions are unreachable by anyone not using a mouse.
    renderSplit()
    expect(
      screen.getByRole('button', { name: 'More actions' })
    ).toBeInTheDocument()
  })

  it('keeps both halves separately focusable', () => {
    renderSplit()
    const primary = screen.getByRole('button', { name: 'Add child' })
    const trigger = screen.getByTestId('split-button-trigger')

    expect(primary).not.toBe(trigger)
    primary.focus()
    expect(document.activeElement).toBe(primary)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
  })

  it('disables both halves together', () => {
    renderSplit({ disabled: true })

    expect(screen.getByRole('button', { name: 'Add child' })).toBeDisabled()
    expect(screen.getByTestId('split-button-trigger')).toBeDisabled()
  })

  it('renders a plain button when there is nothing to put in the menu', () => {
    // An empty chevron is a control that opens onto nothing.
    renderSplit({ actions: [] })

    expect(
      screen.getByRole('button', { name: 'Add child' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('split-button-trigger')).not.toBeInTheDocument()
  })
})
