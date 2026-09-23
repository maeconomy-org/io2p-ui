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
  useFormatter: () => ({
    number: (n: number) => String(n),
    list: (items: string[]) => items.join(', '),
  }),
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
  useFormulas: () => ({
    useGet: () => ({ data: FORMULA }),
    // This file is about the binding CONTROLS. What the preview says, and when it says nothing,
    // is `formula-bind-preview.test.tsx` — it moved there when the app stopped computing it.
    usePreview: () => ({ data: undefined, isPending: false }),
  }),
  useConstants: () => ({
    useList: () => ({ data: { data: [CONSTANT] } }),
    // A bound constant is resolved BY ID, not found in the search page — that is what keeps its
    // label and its preview number correct while the user searches for something else.
    useByIds: (ids: readonly string[]) =>
      new Map(
        ids.filter((id) => id === CONSTANT.id).map((id) => [id, CONSTANT])
      ),
  }),
}))

// `key` is the VALUE id and `propertyKey` the property's — the option's testid is built from the
// latter, so the two are deliberately different here.
const SIBLINGS = [
  { key: 'v-1', propertyKey: 'volume', label: 'Volume', num: 10 },
  { key: 'v-2', propertyKey: 'height', label: 'Height', num: 3 },
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
      args: [{ var: 'volume', constantId: 'c-1' }],
    })

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('co2_factor')
  })

  it('renders a sibling binding as selected', () => {
    renderBindings({ formulaId: 'f-1', args: [{ var: 'volume', ref: 'v-1' }] })

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Volume')
  })

  it('writes a constant binding with no ref', () => {
    // `ref` XOR `constantId`: a stray `ref` alongside would be an arg the server rejects.
    expect(argFromChoice('v', 'constant:c-1')).toEqual({
      var: 'v',
      constantId: 'c-1',
    })
  })

  it('writes a sibling binding with no constant', () => {
    expect(argFromChoice('v', 'sibling:val-1')).toEqual({
      var: 'v',
      ref: 'val-1',
    })
  })

  it('switching kind replaces the binding rather than merging the two', () => {
    const asConstant = argFromChoice('v', 'constant:c-1')!
    const asSibling = argFromChoice('v', 'sibling:val-1')!

    expect(asConstant).not.toHaveProperty('ref')
    expect(asSibling).not.toHaveProperty('constantId')
  })

  it('clears the binding for an empty choice', () => {
    expect(argFromChoice('v', '')).toBeNull()
  })

  it('keeps an id containing a colon intact', () => {
    // Ids carry no colon today, so this guards the SPLIT rather than a real value: only the first
    // separator delimits, and splitting on every one would truncate whatever came after.
    expect(argFromChoice('v', 'constant:ns:c-1')).toEqual({
      var: 'v',
      constantId: 'ns:c-1',
    })
  })

  it('round-trips a constant back to its own option value', () => {
    // What makes a bound constant render as SELECTED instead of blank.
    expect(choiceOf({ var: 'v', constantId: 'c-1' })).toBe('constant:c-1')
  })

  it('round-trips a sibling back to its own option value', () => {
    expect(choiceOf({ var: 'v', ref: 'val-1' })).toBe('sibling:val-1')
  })

  it('maps an unbound variable to no selection', () => {
    expect(choiceOf(undefined)).toBe('')
    expect(choiceOf({ var: 'v' })).toBe('')
  })
})
