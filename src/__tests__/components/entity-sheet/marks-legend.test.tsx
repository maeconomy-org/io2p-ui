import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

import { MarksLegend } from '@/components/entity-sheet/fields/marks-legend'

function openLegend() {
  render(<MarksLegend />)
  fireEvent.click(screen.getByTestId('marks-legend'))
  return screen.getByRole('dialog')
}

describe('MarksLegend', () => {
  it('names every mark for a screen reader, the icon-only ones too', () => {
    const dialog = openLegend()
    const terms = dialog.querySelectorAll('dt')

    expect(terms.length).toBeGreaterThan(0)
    for (const term of terms) expect(term.textContent?.trim()).not.toBe('')
  })

  it('hides the sample icons, so a term is read once, by its name', () => {
    const dialog = openLegend()
    for (const icon of dialog.querySelectorAll('dt svg'))
      expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('explains the "Updating" mark on a total', () => {
    openLegend()
    expect(
      screen.getByText('objects.properties.legend.updating')
    ).toBeInTheDocument()
  })
})
