import { groupedFunctions } from '@/app/formulas/components/formula-reference-dialog'
import { describe, it, expect } from 'vitest'

import {
  builtinNames,
  evaluateExpression,
  FormulaEvalError,
  isValidExpression,
  parseExpression,
  round,
  variablesOf,
} from '@/lib/formula-expression'

// This file exists to assert that the client grammar MATCHES `io2p-core/src/shared/calc.eval.ts`.
// The module it replaced claimed alignment in a comment while being aligned to a different language
// entirely (Java's exp4j), so the preview could show a number the server would never store. A
// comment cannot catch that drift; these can.

describe('grammar alignment with the server', () => {
  it('parses -1^2 as -(1^2), the way the server does', () => {
    // THE case the old evaluator got wrong. Its own header documented the divergence: jsep parsed
    // this as (-1)^2 = 1, so the preview said 1 and the server stored -1.
    expect(evaluateExpression('-1^2', {})).toBe(-1)
  })

  it('treats ^ as exponentiation, not xor', () => {
    expect(evaluateExpression('2^3', {})).toBe(8)
  })

  it('rejects assignment, so a == typo cannot become a silent wrong number', () => {
    // `a = b` would otherwise parse, extract both names, and evaluate to the RHS.
    expect(() => parseExpression('a = b')).toThrow()
  })

  it('rejects member access', () => {
    expect(() => parseExpression('a.b')).toThrow()
  })

  it('rejects array literals — a calc yields one number', () => {
    expect(() => parseExpression('[1, 2]')).toThrow()
  })

  it('rejects the `;` sequence, which would silently discard all but the last statement', () => {
    expect(() => parseExpression('1 ; 2')).toThrow(/sequence/)
  })

  it('allows a conditional, which must not be mistaken for a sequence', () => {
    // `a ? b : c` compiles to IEXPR branches with no IENDSTATEMENT — the reason the check scans for
    // that instruction rather than for the `;` character.
    expect(evaluateExpression('a > b ? a : b', { a: 3, b: 7 })).toBe(7)
  })

  it('rejects the non-deterministic `random` builtin', () => {
    // Reserved: a derived value is re-derived on every rebuild, and replay must be byte-identical.
    expect(() => parseExpression('random()')).toThrow(/non-deterministic/)
  })

  it('rejects a bare reference to random, not just a call', () => {
    expect(() => parseExpression('random + 1')).toThrow(/non-deterministic/)
  })
})

describe('round', () => {
  it('applies the frozen 12-significant-figure policy', () => {
    // Also the reason the preview and the stored value agree on ordinary float noise.
    expect(round(0.1 + 0.2)).toBe(0.3)
  })

  it('keeps 12 significant figures, not 12 decimal places', () => {
    expect(round(123456.789012345)).toBe(123456.789012)
  })

  it('leaves an exact value alone', () => {
    expect(round(42)).toBe(42)
  })
})

describe('variablesOf', () => {
  it('returns the free variables a binding must fill', () => {
    expect(variablesOf('volume * co2_factor')).toEqual(['volume', 'co2_factor'])
  })

  it('excludes builtins, matching the server-derived variables[]', () => {
    // If this drifted, the sheet would ask the user to bind `PI`.
    expect(variablesOf('sqrt(x) + PI')).toEqual(['x'])
  })

  it('dedupes a variable used twice', () => {
    expect(variablesOf('x + x * 2')).toEqual(['x'])
  })

  it('returns nothing for a constant expression', () => {
    expect(variablesOf('2 + 2')).toEqual([])
  })

  it('throws on an invalid expression rather than returning a partial list', () => {
    expect(() => variablesOf('x +* y')).toThrow()
  })
})

describe('evaluateExpression', () => {
  it('evaluates against a numeric scope', () => {
    expect(
      evaluateExpression('volume * co2_factor', {
        volume: 10,
        co2_factor: 0.42,
      })
    ).toBe(4.2)
  })

  it('throws domain rather than returning NaN', () => {
    // The output contract: never a silent 0 or NaN, because that would be stored as a real value.
    expect(() => evaluateExpression('sqrt(-1)', {})).toThrow(FormulaEvalError)
    expect(() => evaluateExpression('sqrt(-1)', {})).toThrow(/NaN/)
  })

  it('throws div-by-zero rather than returning Infinity', () => {
    try {
      evaluateExpression('1 / 0', {})
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as FormulaEvalError).code).toBe('div-by-zero')
    }
  })

  it('throws when the result is not a number', () => {
    // A bare comparison evaluates to a boolean.
    try {
      evaluateExpression('a > b', { a: 2, b: 1 })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as FormulaEvalError).code).toBe('non-numeric-result')
    }
  })

  it('rounds the result to the same precision the server will store', () => {
    expect(evaluateExpression('a + b', { a: 0.1, b: 0.2 })).toBe(0.3)
  })

  it('throws on an unbound variable rather than treating it as zero', () => {
    expect(() => evaluateExpression('x + y', { x: 1 })).toThrow()
  })
})

describe('isValidExpression', () => {
  it('accepts what the server accepts', () => {
    expect(isValidExpression('volume * co2_factor')).toBe(true)
  })

  it('rejects a syntax error', () => {
    expect(isValidExpression('x +* y')).toBe(false)
  })

  it('rejects a banned builtin, so the editor cannot show valid for a 422', () => {
    expect(isValidExpression('random()')).toBe(false)
  })

  it('treats an empty expression as invalid', () => {
    expect(isValidExpression('')).toBe(false)
  })
})

describe('builtinNames', () => {
  it('reads the parser tables rather than a hand-kept list', () => {
    const { functions, constants } = builtinNames()
    // The parser splits its table: `min` is a function, `sqrt` a call-shaped unary operator. Both are
    // equally callable in a formula, so both are offered.
    expect(functions).toContain('min')
    expect(functions).toContain('sqrt')
    expect(constants).toEqual(['E', 'PI'])
  })

  it('omits random, which is rejected at parse', () => {
    // Offering it as an insert chip would hand the user a formula that cannot be saved.
    expect(builtinNames().functions).not.toContain('random')
  })

  it('omits collection functions, which the disabled array grammar cannot feed', () => {
    expect(builtinNames().functions).not.toContain('map')
    expect(builtinNames().functions).not.toContain('filter')
  })

  it('omits symbolic operators, which are not call-shaped', () => {
    expect(builtinNames().functions).not.toContain('!')
    expect(builtinNames().functions).not.toContain('-')
  })

  it('omits boolean constants, since a calc must yield a number', () => {
    expect(builtinNames().constants).not.toContain('true')
  })

  it('does not offer exp4j names the grammar never had', () => {
    // The old reference dialog documented `phi` — from the previous backend's function table.
    expect(builtinNames().constants).not.toContain('phi')
  })

  it('offers only names that actually parse', () => {
    // The contract behind every chip: inserting one must never produce an invalid formula.
    const { functions, constants } = builtinNames()
    for (const name of functions) {
      expect(
        isValidExpression(`${name}(1)`) || isValidExpression(`${name}(1,2)`)
      ).toBe(true)
    }
    for (const name of constants) {
      expect(isValidExpression(name)).toBe(true)
    }
  })
})

describe('the reference dialog matches the parser', () => {
  // The dialog's groups are membership only; the LIST comes from `builtinNames()`. This asserts the
  // derivation actually covers everything, because the hand-written version drifted badly: it
  // claimed `signum` (the name is `sign`) and omitted seventeen real functions after a parser
  // change nobody re-read it against.
  it('shows every function the parser offers, and none it does not', () => {
    const { functions } = builtinNames()
    const shown = groupedFunctions().flatMap((group) => group.fns)

    expect([...shown].sort()).toEqual([...functions].sort())
    expect(shown).toHaveLength(new Set(shown).size)
  })

  it('does not claim a function that was removed for determinism', () => {
    expect(builtinNames().functions).not.toContain('random')
  })
})
