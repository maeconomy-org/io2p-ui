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

  it('fills in a name that starts with $, and nothing inside it', () => {
    const text = (m: Record<string, string>) => (v: string) => m[v]
    expect(
      equationText('$CO2 * a', text({ $CO2: '0.4', a: '2 kg', CO2: 'no' }))
    ).toBe('0.4 × 2 kg')
  })

  it('leaves number literals whole, whatever the variables are called', () => {
    const text = (m: Record<string, string>) => (v: string) => m[v]
    expect(equationText('2.5e-3 * e', text({ e: '100 kWh' }))).toBe(
      '2.5e-3 × 100 kWh'
    )
    expect(equationText('0x10 * x10', text({ x10: '5' }))).toBe('0x10 × 5')
    expect(equationText('1e+3 * e', text({ e: '2' }))).toBe('1e+3 × 2')
  })

  it('brackets a filled-in text that would change how the expression reads', () => {
    const text = (m: Record<string, string>) => (v: string) => m[v]
    expect(equationText('x ^ 2', text({ x: '-3' }))).toBe('(-3) ^ 2')
    expect(equationText('a - b', text({ a: '10', b: '-5' }))).toBe('10 - (-5)')
    expect(
      equationText('e / f', text({ e: '100 kWh', f: '2 kgCO2e/kWh' }))
    ).toBe('100 kWh ÷ (2 kgCO2e/kWh)')
    // A plain unit with a space is not an operator.
    expect(equationText('p * t', text({ p: '2 kW', t: '5 h' }))).toBe(
      '2 kW × 5 h'
    )
  })
})
