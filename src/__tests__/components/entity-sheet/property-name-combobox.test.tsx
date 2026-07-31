import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { PropertyNameCombobox } from '@/components/entity-sheet/fields/property-name-combobox'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

function Harness({
  initialValue = '',
  onChange,
}: {
  initialValue?: string
  onChange?: (key: string, label: string) => void
}) {
  const [value, setValue] = React.useState(initialValue)
  return (
    <PropertyNameCombobox
      value={value}
      onChange={(key, label) => {
        setValue(key)
        onChange?.(key, label)
      }}
      placeholder="name"
      data-testid="combobox-input"
    />
  )
}

describe('PropertyNameCombobox', () => {
  it('does not show suggestions for queries under 2 chars', () => {
    render(<Harness />)
    const input = screen.getByTestId('combobox-input')
    fireEvent.change(input, { target: { value: 'a' } })
    expect(
      screen.queryByTestId('property-name-suggestions')
    ).not.toBeInTheDocument()
  })

  it('shows suggestions once the user types 2+ chars matching the dictionary', () => {
    render(<Harness />)
    const input = screen.getByTestId('combobox-input')
    fireEvent.change(input, { target: { value: 'add' } })
    expect(screen.getByTestId('property-name-suggestions')).toBeInTheDocument()
    expect(
      screen.getByTestId('property-name-suggestion-address')
    ).toBeInTheDocument()
  })

  it('accepting a suggestion (click) emits entry key + localized label', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByTestId('combobox-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'add' } })
    const option = screen.getByTestId('property-name-suggestion-address')
    fireEvent.click(option)
    // onChange called with the dictionary key AND the localized label.
    expect(onChange).toHaveBeenLastCalledWith('address', 'Address')
  })

  it('accepting a suggestion via Enter emits entry key + localized label', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByTestId('combobox-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'add' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('address', 'Address')
  })

  it('ArrowDown moves highlight and Enter picks it', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByTestId('combobox-input') as HTMLInputElement
    // "co" matches multiple entries (Color, Country, Coordinates, ...).
    fireEvent.change(input, { target: { value: 'co' } })
    const list = screen.getByTestId('property-name-suggestions')
    expect(list).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    // onChange fires with some dictionary key — assert it's not the raw "co".
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    const [key, label] = lastCall
    expect(key).not.toBe('co')
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })

  it('Escape closes the suggestion list without changing value', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByTestId('combobox-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'add' } })
    expect(screen.getByTestId('property-name-suggestions')).toBeInTheDocument()
    onChange.mockClear()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(
      screen.queryByTestId('property-name-suggestions')
    ).not.toBeInTheDocument()
    // No additional onChange from the Escape.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('free-text typing emits typed text as both key and label', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByTestId('combobox-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'custom name' } })
    expect(onChange).toHaveBeenLastCalledWith('custom name', 'custom name')
  })

  it('hides suggestions when there are no matches', () => {
    render(<Harness />)
    const input = screen.getByTestId('combobox-input')
    fireEvent.change(input, { target: { value: 'zzzzzzz' } })
    expect(
      screen.queryByTestId('property-name-suggestions')
    ).not.toBeInTheDocument()
  })

  it('closes suggestions on outside click', () => {
    render(
      <div>
        <Harness />
        <button data-testid="outside">outside</button>
      </div>
    )
    const input = screen.getByTestId('combobox-input')
    fireEvent.change(input, { target: { value: 'add' } })
    expect(screen.getByTestId('property-name-suggestions')).toBeInTheDocument()
    act(() => {
      fireEvent.mouseDown(screen.getByTestId('outside'))
    })
    expect(
      screen.queryByTestId('property-name-suggestions')
    ).not.toBeInTheDocument()
  })
})
