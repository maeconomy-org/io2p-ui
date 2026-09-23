import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { FormulaPreviewWarning } from 'io2p-client'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { FormulaWarnings } from '@/components/entity-sheet/fields/formula-warnings'

const w = (over: Partial<FormulaPreviewWarning>): FormulaPreviewWarning => ({
  code: 'hand-conversion',
  detail: 'english detail',
  ...over,
})

function textOf(warning: FormulaPreviewWarning, locale: 'en' | 'nl' = 'en') {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : nl}
    >
      <FormulaWarnings warnings={[warning]} />
    </NextIntlClientProvider>
  )
  return screen.getByTestId(`formula-warning-${warning.code}`).textContent
}

describe('FormulaWarnings', () => {
  // The number is the product of every scaling literal, inverted below 1: `* 0.001` sends 1000.
  // The sentence must not claim the formula contains it.
  it('names the scale of a hand conversion without claiming it is written there', () => {
    const text = textOf(w({ literal: 1000, unit: 't' }))
    expect(text).toContain('multiply or divide the result by 1,000')
    expect(text).toContain('duplicate this one')
  })

  // The net effect, not the operator: `* 0.001` scales down too, and has no division to remove.
  it('names the effect when the node sends it', () => {
    const text = textOf(w({ literal: 1000, scales: 'down', unit: 't' }))
    expect(text).toContain('makes the result 1,000 times smaller')
    expect(text).toContain('without that conversion')
  })

  it('names a result made larger too', () => {
    expect(textOf(w({ literal: 3600000, scales: 'up', unit: 'J' }))).toContain(
      'makes the result 3,600,000 times larger'
    )
  })

  it('writes the effect the Dutch way', () => {
    expect(
      textOf(w({ literal: 1000, scales: 'down', unit: 't' }), 'nl')
    ).toContain('maakt het resultaat 1.000 keer kleiner')
  })

  it('names the variable a conversion constant is bound to', () => {
    expect(
      textOf(w({ literal: 1000, scales: 'down', unit: 't', vars: ['k'] }))
    ).toContain('The constant bound to k (1,000)')
  })

  it('prints a small conversion constant in full, not as 0', () => {
    expect(
      textOf(w({ literal: 0.000001, scales: 'down', unit: 'mg', vars: ['k'] }))
    ).toContain('(0.000001)')
  })

  it('lists several factor variables as a sentence, in the reader’s language', () => {
    expect(
      textOf(w({ code: 'factor', vars: ['f', 'g'], unit: 'kg', per: 'kWh' }))
    ).toContain('f and g are read in kg per kWh')
  })

  it('reads a count partner as "per item", not the symbol', () => {
    expect(
      textOf(w({ code: 'factor', vars: ['f'], unit: 'kg', per: 'pcs' }))
    ).toContain('per item')
  })

  it('falls back to a general sentence when the factor has no named "per" unit', () => {
    expect(textOf(w({ code: 'factor', vars: ['f'], unit: 'kg' }))).toContain(
      'per standard unit of what it multiplies'
    )
  })

  // Advising a unit the node is not sure of could move the value out of every total.
  it('suggests a unit only when the node names one', () => {
    expect(textOf(w({ code: 'declare-unit', unit: 'kgCO2e' }))).toContain(
      'set kgCO2e as the result unit'
    )
  })

  it('says a unit-less result still counts, and what a multiplier does with it', () => {
    const text = textOf(w({ code: 'declare-unit' }))
    expect(text).toContain('counts in the total without a unit')
    expect(text).toContain('left out of the total')
    expect(text).toContain('set its real unit as the result unit')
  })

  // The set is open: a new code must still say something, and the English detail is all there is.
  it('shows the node’s own text for a code it does not know', () => {
    expect(textOf(w({ code: 'something-new' }))).toBe('english detail')
  })

  it('shows the node’s own text when a known code lacks the fields its sentence needs', () => {
    expect(textOf(w({ unit: 't' }))).toBe('english detail')
  })

  it('shows the node’s own text for a factor with no variables or no unit', () => {
    expect(textOf(w({ code: 'factor', unit: 'kg' }))).toBe('english detail')
  })

  it('writes the number and the list the Dutch way', () => {
    expect(textOf(w({ literal: 1000, unit: 't' }), 'nl')).toContain('met 1.000')
  })

  it('shows a factor as advice and the rest as a warning', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <FormulaWarnings
          warnings={[
            w({ literal: 1000, unit: 't' }),
            w({ code: 'factor', vars: ['f'], unit: 'kg' }),
          ]}
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId('formula-warning-factor').className).toContain(
      'text-muted-foreground'
    )
    expect(
      screen.getByTestId('formula-warning-hand-conversion').className
    ).toContain('text-amber-600')
  })
})
