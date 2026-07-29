import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CalcInput } from 'io2p-client'

import {
  FormulaBindings,
  argFromChoice,
  choiceOf,
} from '@/components/entity-sheet/fields/formula-value-editor'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const FORMULA = {
  id: 'f-1',
  name: 'CO2',
  expression: 'volume * co2_factor',
  variables: ['volume', 'co2_factor'],
}

const CONSTANT = {
  id: 'c-1',
  name: 'co2_factor',
  system: false,
  versions: [
    { version: 1, data: '0.40', num: 0.4, ts: 1 },
    { version: 2, data: '0.42', num: 0.42, ts: 2 },
  ],
}

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({ useGet: () => ({ data: FORMULA }) }),
  useConstants: () => ({ useList: () => ({ data: { data: [CONSTANT] } }) }),
}))

const SIBLINGS = [
  { key: 'v-1', label: 'Volume', num: 10 },
  { key: 'v-2', label: 'Height', num: 3 },
]

const EMPTY_CALC: CalcInput = { formulaId: 'f-1', args: [] }

function renderBindings(calc: CalcInput = EMPTY_CALC) {
  const onChange = vi.fn()
  render(
    <FormulaBindings calc={calc} siblings={SIBLINGS} onChange={onChange} />
  )
  return { onChange }
}

describe('FormulaBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Radix relies on both; jsdom implements neither.
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    window.HTMLElement.prototype.hasPointerCapture = vi.fn()
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  it('offers a control per formula variable', () => {
    renderBindings()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('renders a constant binding as selected rather than blank', () => {
    // A constant arg has no `ref`. A sibling-only picker rendered it EMPTY, which reads as unbound
    // when it is in fact bound — the bug this replaced.
    renderBindings({
      formulaId: 'f-1',
      args: [{ var: 'volume', constant: 'co2_factor' }],
    })

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('co2_factor')
  })

  it('renders a sibling binding as selected', () => {
    renderBindings({ formulaId: 'f-1', args: [{ var: 'volume', ref: 'v-1' }] })

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Volume')
  })

  it('previews the result once every variable is bound', () => {
    // 10 * 0.42, resolved across BOTH kinds — a sibling and a constant.
    renderBindings({
      formulaId: 'f-1',
      args: [
        { var: 'volume', ref: 'v-1' },
        { var: 'co2_factor', constant: 'co2_factor' },
      ],
    })

    expect(screen.getByText(/4\.2/)).toBeInTheDocument()
  })

  it('previews nothing while a variable is unbound', () => {
    // Half an answer is worse than none: it would look like the stored value.
    renderBindings({ formulaId: 'f-1', args: [{ var: 'volume', ref: 'v-1' }] })

    expect(screen.queryByText(/objects.formulaEditor.result/)).toBeNull()
  })

  it('previews nothing when a sibling has no number yet', () => {
    // A template preset arrives blank but already bound.
    render(
      <FormulaBindings
        calc={{
          formulaId: 'f-1',
          args: [
            { var: 'volume', ref: 'v-3' },
            { var: 'co2_factor', constant: 'co2_factor' },
          ],
        }}
        siblings={[{ key: 'v-3', label: 'Empty' }]}
        onChange={vi.fn()}
      />
    )

    expect(screen.queryByText(/objects.formulaEditor.result/)).toBeNull()
  })
})

// The picker's option values encode WHICH KIND of binding was chosen. Radix Select cannot be opened
// in jsdom, so the exclusivity is asserted on the pure functions behind it — which is where it lives.
describe('binding choice', () => {
  it('writes a constant binding with no ref', () => {
    // `ref` XOR `constant`: a stray `ref` alongside would be an arg the server rejects.
    expect(argFromChoice('v', 'constant:co2_factor')).toEqual({
      var: 'v',
      constant: 'co2_factor',
    })
  })

  it('writes a sibling binding with no constant', () => {
    expect(argFromChoice('v', 'sibling:val-1')).toEqual({
      var: 'v',
      ref: 'val-1',
    })
  })

  it('switching kind replaces the binding rather than merging the two', () => {
    const asConstant = argFromChoice('v', 'constant:co2_factor')!
    const asSibling = argFromChoice('v', 'sibling:val-1')!

    expect(asConstant).not.toHaveProperty('ref')
    expect(asSibling).not.toHaveProperty('constant')
  })

  it('clears the binding for an empty choice', () => {
    expect(argFromChoice('v', '')).toBeNull()
  })

  it('keeps a name containing a colon intact', () => {
    // Only the FIRST separator delimits; splitting on every one would truncate the name.
    expect(argFromChoice('v', 'constant:ns:co2')).toEqual({
      var: 'v',
      constant: 'ns:co2',
    })
  })

  it('round-trips a constant back to its own option value', () => {
    // What makes a bound constant render as SELECTED instead of blank.
    expect(choiceOf({ var: 'v', constant: 'co2_factor' })).toBe(
      'constant:co2_factor'
    )
  })

  it('round-trips a sibling back to its own option value', () => {
    expect(choiceOf({ var: 'v', ref: 'val-1' })).toBe('sibling:val-1')
  })

  it('maps an unbound variable to no selection', () => {
    expect(choiceOf(undefined)).toBe('')
    expect(choiceOf({ var: 'v' })).toBe('')
  })
})
