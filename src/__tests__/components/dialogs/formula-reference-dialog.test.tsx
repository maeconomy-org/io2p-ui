import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { FormulaReferenceDialog } from '@/components/dialogs/formula-reference-dialog'

function renderDialog(locale: 'en' | 'nl' = 'en') {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : nl}
    >
      <FormulaReferenceDialog open onOpenChange={() => {}} section="units" />
    </NextIntlClientProvider>
  )
  return screen.getByTestId('formula-reference-units').textContent ?? ''
}

describe('FormulaReferenceDialog — units', () => {
  it('has a units section', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Units' })).toBeInTheDocument()
    expect(screen.getByText(/10 t is read as 10,000 kg/)).toBeInTheDocument()
  })

  // With plain-number inputs the declaration does not convert, so a hand conversion is right; the
  // advice not to divide by 1000 holds only when the inputs have units.
  it('advises against dividing by 1000 only when the inputs have units', () => {
    const units = renderDialog()
    expect(units).toContain(
      'When the inputs have units, it converts by itself: do not also divide by 1000'
    )
    expect(units).toContain('any conversion is yours to write')
  })

  // Emission factors are usually constants, and without a result unit a constant is a plain
  // multiplier: 100 kWh × 0.5 is stored as a checked 50 kWh, with no warning.
  it('reads a unitless number as a factor only with a result unit', () => {
    const units = renderDialog()
    expect(units).toContain(
      'is read as a factor only when the formula has a result unit'
    )
    expect(units).toContain('a constant is a plain multiplier')
    expect(units).toContain('100 kWh × 0.5 is 50 kWh')
  })

  it('does not promise a named unit for every combination', () => {
    expect(renderDialog()).toContain(
      'such as V × Ah, the node cannot name the unit'
    )
  })

  // Four states: "left out" alone would be false without a result unit, and a multiplier drops
  // the object either way.
  it('says what an unchecked result means for totals and for a multiplier', () => {
    const units = renderDialog()
    expect(units).toContain('without one it counts in the total without a unit')
    expect(units).toContain('multiplier leaves that object out of the total')
  })

  it('has the section in Dutch', () => {
    renderDialog('nl')
    expect(
      screen.getByRole('heading', { name: 'Eenheden' })
    ).toBeInTheDocument()
  })
})
