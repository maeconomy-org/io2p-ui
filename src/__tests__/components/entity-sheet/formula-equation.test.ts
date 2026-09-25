import { describe, it, expect } from 'vitest'

import { equationText } from '@/components/entity-sheet/fields/formula-equation'

const texts: Record<string, string> = {
  p: '2 kW',
  t: '5 h',
  a: '5 kg',
  e: '20 kWh',
}
const textFor = (name: string) => texts[name]

describe('equationText', () => {
  it('writes each input in place of its variable', () => {
    expect(equationText('p * t', textFor)).toBe('2 kW × 5 h')
  })

  it('spaces an operator written without spaces', () => {
    expect(equationText('p*t/e', textFor)).toBe('2 kW × 5 h ÷ 20 kWh')
  })

  it('keeps a function name and closes its brackets tightly', () => {
    expect(equationText('log( a )', textFor)).toBe('log(5 kg)')
  })

  it('keeps a variable with no text as written', () => {
    expect(equationText('a + q', textFor)).toBe('5 kg + q')
  })

  it('does not replace part of a longer name', () => {
    expect(equationText('pt + p', textFor)).toBe('pt + 2 kW')
  })

  it('keeps conditions and numbers', () => {
    expect(equationText('p * t > e ? 1 : 0', textFor)).toBe(
      '2 kW × 5 h > 20 kWh ? 1 : 0'
    )
  })
})
