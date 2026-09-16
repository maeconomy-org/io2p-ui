// Property args reach the evaluator ALREADY CANONICAL, so when the result still KEEPS their
// dimension it is canonical too: the node applies no factor and the declared unit only picks the
// symbol to read it in. A product of two unit-bearing args, a power, or a recipe over unitless
// args alone IS scaled by the declared factor. The preview has to say the same thing the sheet
// will, or it teaches the wrong model before anything is saved.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CalcInput } from 'io2p-client'
import type { FormulaSibling } from '@/components/entity-sheet/fields/formula-value-editor'

const formula = vi.hoisted(() => ({
  current: {
    id: 'f-1',
    name: 'total',
    expression: 'a + b',
    variables: ['a', 'b'],
    unit: 't' as string | undefined,
  },
}))

const unit = (
  symbol: string,
  dimension: string,
  canonical: boolean,
  toCanonical: number
) => ({ symbol, dimension, aliases: [], canonical, toCanonical })

const UNITS = [
  unit('kg', 'mass', true, 1),
  unit('t', 'mass', false, 1000),
  unit('m', 'length', true, 1),
  unit('m2', 'area', true, 1),
]

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({ useGet: () => ({ data: formula.current }) }),
  useUnits: () => ({ data: UNITS }),
  useConstants: () => ({
    useList: () => ({ data: { data: [] } }),
    useByIds: () => new Map(),
  }),
}))

import { FormulaBindings } from '@/components/entity-sheet/fields/formula-value-editor'

/** `10 t` as the node stores it: num 10000, unit kg. */
const sib = (key: string, num: number, u?: string): FormulaSibling => ({
  key,
  propertyKey: key,
  label: key,
  num,
  ...(u ? { unit: u } : {}),
})

const TWO_TONNES = [sib('v-a', 10000, 'kg'), sib('v-b', 10000, 'kg')]

const bind = (...vars: string[]): CalcInput => ({
  formulaId: 'f-1',
  args: vars.map((v, i) => ({ var: v, ref: i === 0 ? 'v-a' : 'v-b' })),
})

function renderBindings(siblings: FormulaSibling[] = TWO_TONNES) {
  render(
    <FormulaBindings
      calc={bind(...formula.current.variables)}
      siblings={siblings}
      onChange={vi.fn()}
    />
  )
}

const preview = () => screen.getByTestId('formula-preview').textContent
const problem = () => screen.queryByTestId('formula-dimension-problem')

describe('the bind preview for a declared result unit', () => {
  beforeEach(() => {
    formula.current = {
      id: 'f-1',
      name: 'total',
      expression: 'a + b',
      variables: ['a', 'b'],
      unit: 't',
    }
  })

  it('converts OUT of canonical when the result keeps the args dimension', () => {
    // 10 t + 10 t. The canonical sum is 20000 kg and the node stores exactly that — the
    // declaration adds no scale, so the reader should see 20 t, never 20000 t.
    renderBindings()

    expect(preview()).toContain('20 t')
    expect(preview()).not.toContain('20000 t')
  })

  it('keeps the dimension through a scalar divide — an average is still a weight', () => {
    // `(a + b) / 2` over two 10 t values. This is the case that sent core back a second time:
    // an average had been treated as "scaled" and silently multiplied by 1000.
    formula.current = { ...formula.current, expression: '(a + b) / 2' }
    renderBindings()

    expect(preview()).toContain('10 t')
  })

  it('keeps the dimension through a scalar multiply', () => {
    formula.current = {
      ...formula.current,
      expression: 'a * 2',
      variables: ['a'],
    }
    renderBindings([sib('v-a', 10000, 'kg')])

    expect(preview()).toContain('20 t')
  })

  it('keeps the dimension through an additive literal', () => {
    // `a + 500` over 10 t. The args are canonical, so the bare number is read in kg too.
    formula.current = {
      ...formula.current,
      expression: 'a + 500',
      variables: ['a'],
    }
    renderBindings([sib('v-a', 10000, 'kg')])

    expect(preview()).toContain('10.5 t')
  })

  it('SCALES when no argument carries a unit', () => {
    // Only then is the declaration giving the number a unit rather than naming one it already has.
    formula.current = { ...formula.current, expression: 'a + b' }
    renderBindings([sib('v-a', 10), sib('v-b', 10)])

    expect(preview()).toContain('20 t')
  })

  it('prints a bare number when the recipe declares nothing', () => {
    formula.current = { ...formula.current, unit: undefined }
    renderBindings()

    expect(preview()).toContain('20000')
    expect(problem()).toBeNull()
  })

  it('no longer claims the result will be multiplied', () => {
    // The node stopped rescaling a dimension-keeping result; the warning that said so is false.
    renderBindings()

    expect(screen.queryByTestId('formula-declared-rescale')).toBeNull()
  })
})

describe('refusals the node makes before any factor', () => {
  beforeEach(() => {
    formula.current = {
      id: 'f-1',
      name: 'total',
      expression: 'a + b',
      variables: ['a', 'b'],
      unit: undefined,
    }
  })

  it('flags arguments that cannot be added — kg with m', () => {
    renderBindings([sib('v-a', 10, 'kg'), sib('v-b', 3, 'm')])

    expect(problem()).toHaveTextContent('dimension-mismatch')
  })

  it('flags a declaration that crosses dimensions', () => {
    formula.current = { ...formula.current, unit: 'm2' }
    renderBindings()

    expect(problem()).toHaveTextContent('dimension-mismatch')
  })

  it('flags a declared symbol this node does not know', () => {
    formula.current = { ...formula.current, unit: 'stone' }
    renderBindings()

    expect(problem()).toHaveTextContent('unknown-unit')
  })

  it('stays silent when the units agree', () => {
    formula.current = { ...formula.current, unit: 'kg' }
    renderBindings()

    expect(problem()).toBeNull()
  })

  it('stays silent on a multiplicative expression, which may cross dimensions', () => {
    // kg / m3 is a density. The node gates both refusals on inheritance-safety for this reason.
    formula.current = {
      ...formula.current,
      expression: 'a * b',
      unit: 'm2',
    }
    renderBindings([sib('v-a', 10, 'kg'), sib('v-b', 3, 'm')])

    expect(problem()).toBeNull()
  })
})
