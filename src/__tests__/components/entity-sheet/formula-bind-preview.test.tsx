/**
 * What the bind preview shows, now that it ASKS the node instead of working it out.
 *
 * This file used to assert twelve unit rules — when a declared unit converts, when it only names,
 * which products keep a dimension. Every one of those is the node's, tested there over ~150 cases
 * and a property suite, and the app's second copy of them had already gone stale: it kept rules
 * core had replaced, so the figure on screen was not the figure that would be stored.
 *
 * So what is left to test here is not arithmetic. It is: does the editor ask the right question,
 * does it relay the answer without reinterpreting it, and does it stay useful when there is no
 * answer at all.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

const preview = vi.hoisted(() => ({
  data: undefined as unknown,
  isFetching: false,
  lastBody: undefined as unknown,
  bodies: [] as unknown[],
}))

const unitsHint = vi.hoisted(() => ({ read: false, markRead: () => {} }))

vi.mock('@/hooks/ui/use-preference', () => ({
  useFlagPreference: () => [unitsHint.read, unitsHint.markRead, true],
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({
    number: (n: number) => String(n),
    list: (items: string[]) => items.join(', '),
  }),
}))

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useGet: () => ({ data: formula.current }),
    usePreview: (body: unknown) => {
      preview.lastBody = body
      // DISTINCT bodies: the hook is called on every render, but the query key is the body, so
      // what reaches the network is the number of different ones.
      if (body !== undefined) preview.bodies.push(JSON.stringify(body))
      return { data: preview.data, isFetching: preview.isFetching }
    },
  }),
  useConstants: () => ({
    useList: () => ({ data: { data: [] } }),
    useByIds: () => new Map(),
  }),
}))

import { FormulaBindings } from '@/components/entity-sheet/fields/formula-value-editor'

/** `10 t` as the node stores it: num 10000, unit kg. */
const sib = (key: string, num?: number, u?: string, data?: string) =>
  ({
    key,
    propertyKey: key,
    label: key,
    ...(num !== undefined && { num }),
    ...(u && { unit: u }),
    ...(data && { data }),
  }) as FormulaSibling

const TWO_TONNES = [sib('v-a', 10000, 'kg'), sib('v-b', 10000, 'kg')]

const bind = (...vars: string[]): CalcInput => ({
  formulaId: 'f-1',
  args: vars.map((v, i) => ({ var: v, ref: i === 0 ? 'v-a' : 'v-b' })),
})

function renderBindings(
  siblings: FormulaSibling[] = TWO_TONNES,
  calc: CalcInput = bind('a', 'b')
) {
  render(<FormulaBindings calc={calc} siblings={siblings} onChange={vi.fn()} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  formula.current = {
    id: 'f-1',
    name: 'total',
    expression: 'a + b',
    variables: ['a', 'b'],
    unit: 't',
  }
  preview.data = undefined
  preview.isFetching = false
  preview.lastBody = undefined
  preview.bodies = []
  unitsHint.read = false
})

describe('the question the editor asks', () => {
  // A stored value's `data` is DISPLAY text — a derived one reads "0.02 MWh" while its number is
  // 20 in kWh — so sending it as typed would change the scale. The number is the truth.
  it('sends a stored value as its canonical number and unit', () => {
    renderBindings()

    expect(preview.lastBody).toEqual({
      expression: 'a + b',
      unit: 't',
      args: [
        { var: 'a', num: 10000, unit: 'kg' },
        { var: 'b', num: 10000, unit: 'kg' },
      ],
    })
  })

  // A saved formula value can be an input. Core makes a result that reads an unchecked value
  // unchecked too, so the question must say so or the answer is about a checked input.
  it('says a saved formula input is unchecked when it is', () => {
    renderBindings([
      { ...sib('v-a', 1200), unitVerified: false },
      TWO_TONNES[1],
    ])

    expect((preview.lastBody as { args: unknown[] }).args[0]).toEqual({
      var: 'a',
      num: 1200,
      unitVerified: false,
    })
  })

  // The NUMBER wins whenever there is one, and this is the case that proves the order rather than
  // relying on the collector never producing both. A derived value's text reads "0.02 MWh" while
  // its number is 20 in kWh — sending the text would change the scale by a factor nothing names.
  it('prefers the number over the text when a value carries both', () => {
    renderBindings([sib('v-a', 10000, 'kg', '10 t'), TWO_TONNES[1]])

    expect((preview.lastBody as { args: unknown[] }).args[0]).toEqual({
      var: 'a',
      num: 10000,
      unit: 'kg',
    })
  })

  // The node has not normalized this yet, so there IS no number — and its text is the only truth
  // there is. Before this, a just-typed "10 t" previewed nothing at all.
  it('sends a just-typed value as the text the author wrote', () => {
    renderBindings([sib('v-a', undefined, undefined, '10 t'), TWO_TONNES[1]])

    expect((preview.lastBody as { args: unknown[] }).args[0]).toEqual({
      var: 'a',
      data: '10 t',
    })
  })

  // No version: the node pins one at bind time, so the preview answers about binding NOW.
  it('sends a constant as its id alone', () => {
    renderBindings(TWO_TONNES, {
      formulaId: 'f-1',
      args: [
        { var: 'a', ref: 'v-a' },
        { var: 'b', constantId: 'c-9' },
      ],
    })

    expect((preview.lastBody as { args: unknown[] }).args[1]).toEqual({
      var: 'b',
      constantId: 'c-9',
    })
  })

  // A half-made binding is not a smaller question, it is a different one. Asking it would answer
  // about a formula nobody is writing.
  it('asks nothing while a variable is unbound', () => {
    renderBindings(TWO_TONNES, {
      formulaId: 'f-1',
      args: [{ var: 'a', ref: 'v-a' }],
    })

    expect(preview.lastBody).toBeUndefined()
  })

  it('asks nothing when a binding points at a value that is gone', () => {
    renderBindings([TWO_TONNES[0]])

    expect(preview.lastBody).toBeUndefined()
  })

  // A template preset arrives with its formula already bound and its values blank. There is
  // neither a number nor typed text, so there is nothing to ask about — and the binding itself
  // is correct, which is why it must not read as broken.
  it('asks nothing when the bound value is still empty', () => {
    renderBindings([sib('v-a'), TWO_TONNES[1]])

    expect(preview.lastBody).toBeUndefined()
  })
})

describe('the answer it shows', () => {
  // No figure, by decision: the value row shows what was actually stored, moments later and from
  // the same source. A second number in a second place is what drifted before — and the one that
  // was wrong was always this one.
  it('shows no result figure at all', () => {
    preview.data = { num: 20000, unit: 'kg', data: '20 t', warnings: [] }
    renderBindings()

    expect(screen.queryByText(/20 t/)).toBeNull()
  })

  // A refusal arrives INSIDE a successful preview. That is what keeps it distinct from not having
  // reached the node at all — the two look nothing alike and must not read alike.
  it('shows a refusal as what will happen, not as a failure to check', () => {
    preview.data = {
      error: { code: 'dimension-mismatch', detail: 'kg + m' },
      warnings: [],
    }
    renderBindings()

    expect(screen.getByTestId('formula-dimension-problem')).toBeInTheDocument()
  })

  // The node's `detail` is English by contract, so it is demoted rather than dropped — exactly
  // what the value row does with the same refusal. It matters most for a code this app does not
  // know, where the sentence above is generic and this is the only thing naming the real cause.
  it('keeps the node’s own explanation as a secondary line', () => {
    preview.data = {
      error: { code: 'dimension-mismatch', detail: 'kg + m' },
      warnings: [],
    }
    renderBindings()

    expect(
      screen.getByTestId('formula-dimension-problem').textContent
    ).toContain('kg + m')
  })

  // An unknown code must not print an identifier at the user: the node's set is open.
  it('falls back to a generic sentence for a code it does not know', () => {
    preview.data = {
      error: { code: 'something-new', detail: 'x' },
      warnings: [],
    }
    renderBindings()

    const text = screen.getByTestId('formula-dimension-problem').textContent
    expect(text).toContain('formulaError')
    expect(text).not.toContain('something-new')
  })
})

// Three states, not two. Only an explicit `false` means the node could not check the unit; an
// absent field is an answer that says nothing about it, and warning on it would be the green tick
// this replaced, inverted.
describe('an unchecked unit', () => {
  it('warns that a result with a unit will be left out of totals', () => {
    preview.data = { num: 5, unit: 'kg', unitVerified: false, warnings: [] }
    renderBindings()

    expect(screen.getByTestId('formula-unit-unverified')).toHaveTextContent(
      'objects.formulaEditor.unitUnverified'
    )
  })

  // Without a unit the node counts it in the no-unit total, so "left out" would be false.
  it('warns that a result without a unit counts in the total without a unit', () => {
    preview.data = { num: 5, unitVerified: false, warnings: [] }
    renderBindings()

    expect(screen.getByTestId('formula-unit-unverified')).toHaveTextContent(
      'objects.formulaEditor.unitUnverifiedPlain'
    )
  })

  it('stays quiet when the node checked it', () => {
    preview.data = { num: 5, unit: 'kg', unitVerified: true, warnings: [] }
    renderBindings()

    expect(screen.queryByTestId('formula-unit-unverified')).toBeNull()
  })

  it('stays quiet when the answer says nothing about it', () => {
    preview.data = { num: 5, unit: 'kg', warnings: [] }
    renderBindings()

    expect(screen.queryByTestId('formula-unit-unverified')).toBeNull()
  })
})

// Rendered whether or not the formula has variables: a result unit converts either way.
describe('how units work', () => {
  it('offers the explanation, marked unread until opened', () => {
    renderBindings()

    expect(
      screen.getByRole('button', {
        name: 'objects.formulaEditor.unitsHelp — onboarding.hintUnread',
      })
    ).toBeInTheDocument()
  })

  it('drops the unread mark once the user has read it', () => {
    unitsHint.read = true
    renderBindings()

    expect(
      screen.getByRole('button', { name: 'objects.formulaEditor.unitsHelp' })
    ).toBeInTheDocument()
  })

  it('offers it for a formula with no variables too', () => {
    formula.current = { ...formula.current, variables: [], expression: '2 * 3' }
    renderBindings()

    expect(screen.getByTestId('formula-units-help')).toBeInTheDocument()
  })
})

// A rule that multiplies this property's totals by a quantity, and a formula that reads the same
// quantity, put it in the total twice. Known from the binding alone, before any answer.
describe('a quantity counted twice', () => {
  const withQuantity: FormulaSibling[] = [
    { key: 'v-a', propertyKey: 'Quantity', label: 'Aantal', num: 4 },
    TWO_TONNES[1],
  ]

  it('warns when the formula reads the key the rule multiplies by', () => {
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={withQuantity}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.getByTestId('formula-counted-twice').textContent).toContain(
      '"quantity":"Aantal"'
    )
  })

  it('says nothing when the formula does not read it', () => {
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={TWO_TONNES}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.queryByTestId('formula-counted-twice')).toBeNull()
  })

  it('says nothing when no rule multiplies this property', () => {
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={withQuantity}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByTestId('formula-counted-twice')).toBeNull()
  })

  it('matches a quantity that has only a label yet', () => {
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={[
          {
            key: 'v-a',
            propertyKey: 'Aantal',
            ruleKey: 'quantity',
            label: 'Aantal',
            num: 4,
          },
          TWO_TONNES[1],
        ]}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.getByTestId('formula-counted-twice')).toBeInTheDocument()
  })

  // A refused result stores no number, so it is not counted even once.
  it('says nothing when the node refuses the result', () => {
    preview.data = {
      error: { code: 'dimension-mismatch', detail: 'kg + m' },
      warnings: [],
    }
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={withQuantity}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.getByTestId('formula-dimension-problem')).toBeInTheDocument()
    expect(screen.queryByTestId('formula-counted-twice')).toBeNull()
  })

  // Left out of every total, it is not counted even once.
  it('says nothing when the result is left out of totals', () => {
    preview.data = { num: 5, unit: 'kg', unitVerified: false, warnings: [] }
    render(
      <FormulaBindings
        calc={bind('a', 'b')}
        siblings={withQuantity}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.queryByTestId('formula-counted-twice')).toBeNull()
  })

  // A sibling offered but not bound is not read by the formula.
  it('says nothing for a quantity that is on the object but not bound', () => {
    render(
      <FormulaBindings
        calc={{ formulaId: 'f-1', args: [{ var: 'a', ref: 'v-b' }] }}
        siblings={withQuantity}
        onChange={vi.fn()}
        countedBy="quantity"
      />
    )
    expect(screen.queryByTestId('formula-counted-twice')).toBeNull()
  })
})

describe('authoring warnings', () => {
  // While the answer is on its way the old one is hidden; busy keeps a screen reader from reading
  // the same warnings again after every pause.
  it('marks the region busy while the answer is not in yet', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <FormulaBindings
          calc={bind('a', 'b')}
          siblings={[sib('v-a', undefined, undefined, '10 m'), TWO_TONNES[1]]}
          onChange={vi.fn()}
        />
      )
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false')

      rerender(
        <FormulaBindings
          calc={bind('a', 'b')}
          siblings={[sib('v-a', undefined, undefined, '10 t'), TWO_TONNES[1]]}
          onChange={vi.fn()}
        />
      )
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

      act(() => vi.advanceTimersByTime(400))
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays busy while the settled question is still being answered', () => {
    preview.isFetching = true
    renderBindings()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  // A live region announces what appears in it, so it has to be there before the answer is.
  it('announces the answer in a region that exists before it arrives', () => {
    renderBindings()
    const region = screen.getByRole('status')

    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('objects.formulaEditor.calculatedOnSave')
  })

  it('shows each warning the node sends', () => {
    preview.data = {
      num: 1.5,
      unit: 'kg',
      unitVerified: true,
      warnings: [
        {
          code: 'hand-conversion',
          detail: 'x',
          literal: 1000,
          scales: 'down',
          unit: 't',
        },
        { code: 'factor', detail: 'y', vars: ['f'], unit: 'kg' },
      ],
    }
    renderBindings()

    expect(
      screen.getByTestId('formula-warning-hand-conversion')
    ).toBeInTheDocument()
    expect(screen.getByTestId('formula-warning-factor')).toBeInTheDocument()
  })

  // The declare-unit warning is the precise version of the plain unchecked line: one, not both.
  it('replaces the plain unchecked line when the node asks for a unit', () => {
    preview.data = {
      num: 1200,
      unitVerified: false,
      warnings: [{ code: 'declare-unit', detail: 'x' }],
    }
    renderBindings()

    expect(
      screen.getByTestId('formula-warning-declare-unit')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('formula-unit-unverified')).toBeNull()
  })
})

/**
 * What the panel says instead of a figure.
 *
 * One static sentence, always, whatever the request is doing. Nothing is waiting on the answer
 * any more, so there is no in-flight state to show and no failure to report — a request that
 * never arrives simply means one fewer warning, never a refusal the author did not earn.
 */
describe('what it says instead of a result', () => {
  it('says the value will be calculated on save', () => {
    preview.data = { num: 20000, data: '20 t', warnings: [] }
    renderBindings()

    expect(
      screen.getByText('objects.formulaEditor.calculatedOnSave')
    ).toBeInTheDocument()
  })

  // "Calculated when you save" beside a refusal would promise a number that will not come.
  it('says no number will be stored when the node refuses', () => {
    preview.data = {
      error: { code: 'dimension-mismatch', detail: 'kg + m' },
      warnings: [],
    }
    renderBindings()

    expect(
      screen.getByText('objects.formulaEditor.errorOnSave')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('objects.formulaEditor.calculatedOnSave')
    ).toBeNull()
  })

  it('says the same thing when the request failed outright', () => {
    preview.data = undefined
    renderBindings()

    expect(
      screen.getByText('objects.formulaEditor.calculatedOnSave')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('formula-dimension-problem')).toBeNull()
  })

  it('says it while a binding is still incomplete', () => {
    renderBindings(TWO_TONNES, {
      formulaId: 'f-1',
      args: [{ var: 'a', ref: 'v-a' }],
    })

    expect(
      screen.getByText('objects.formulaEditor.calculatedOnSave')
    ).toBeInTheDocument()
  })
})

/**
 * The sibling list is rebuilt on every render of the sheet and carries each value's typed TEXT,
 * so a neighbouring field being typed into changes the request on every keystroke: "1", "10",
 * "10 ", "10 t" is four different questions. An earlier draft of this phase asked all four.
 *
 * Nothing waits on the answer now — there is no figure to show — so the delay is free.
 */
describe('typing nearby', () => {
  it('asks once the typing settles, not once per keystroke', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <FormulaBindings
          calc={bind('a', 'b')}
          siblings={[sib('v-a', undefined, undefined, '1'), TWO_TONNES[1]]}
          onChange={vi.fn()}
        />
      )
      const distinct = () => new Set(preview.bodies).size
      const afterMount = distinct()

      for (const text of ['10', '10 ', '10 t']) {
        rerender(
          <FormulaBindings
            calc={bind('a', 'b')}
            siblings={[sib('v-a', undefined, undefined, text), TWO_TONNES[1]]}
            onChange={vi.fn()}
          />
        )
      }

      // Still only what the first render asked: every keystroke restarted the timer.
      expect(distinct()).toBe(afterMount)

      act(() => vi.advanceTimersByTime(400))
      const settled = JSON.parse(preview.bodies.at(-1) as string) as {
        args: { data?: string }[]
      }
      expect(settled.args[0].data).toBe('10 t')
      // One more than the mount asked for — the settled text, not the three on the way to it.
      expect(distinct()).toBe(afterMount + 1)
    } finally {
      vi.useRealTimers()
    }
  })

  // A refusal about the old text must not sit over the new one while the wait runs.
  it('hides an answer about the previous binding while the new one settles', () => {
    vi.useFakeTimers()
    try {
      preview.data = {
        error: { code: 'dimension-mismatch', detail: 'kg + m' },
        warnings: [],
      }
      const { rerender } = render(
        <FormulaBindings
          calc={bind('a', 'b')}
          siblings={[sib('v-a', undefined, undefined, '10 m'), TWO_TONNES[1]]}
          onChange={vi.fn()}
        />
      )
      expect(
        screen.getByTestId('formula-dimension-problem')
      ).toBeInTheDocument()

      rerender(
        <FormulaBindings
          calc={bind('a', 'b')}
          siblings={[sib('v-a', undefined, undefined, '10 t'), TWO_TONNES[1]]}
          onChange={vi.fn()}
        />
      )
      expect(screen.queryByTestId('formula-dimension-problem')).toBeNull()

      act(() => vi.advanceTimersByTime(400))
      expect(
        screen.getByTestId('formula-dimension-problem')
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
