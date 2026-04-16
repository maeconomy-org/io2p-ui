import { describe, it, expect } from 'vitest'

import {
  extractVariables,
  safeEvaluate,
  evaluateAst,
  MATH_FUNCTIONS,
  BUILTIN_CONSTANTS,
  BUILTIN_NAMES,
} from '@/components/properties/utils/formula-evaluation'
import jsep from 'jsep'

import { VALID_FORMULAS, ERROR_FORMULAS } from './formula-fixtures'

describe('formula-evaluation pure functions', () => {
  // ─── Export / constant checks ─────────────────────────────────────

  describe('constants', () => {
    it('exposes all exp4j built-in math functions', () => {
      const exp4jFunctions = [
        'abs',
        'acos',
        'asin',
        'atan',
        'cbrt',
        'ceil',
        'cos',
        'cosh',
        'exp',
        'floor',
        'log',
        'log2',
        'log10',
        'sin',
        'sinh',
        'sqrt',
        'tan',
        'tanh',
        'signum',
      ]
      for (const fn of exp4jFunctions) {
        expect(MATH_FUNCTIONS).toHaveProperty(fn)
      }
    })

    it('exposes backward-compat functions (round, pow, min, max)', () => {
      expect(MATH_FUNCTIONS).toHaveProperty('round')
      expect(MATH_FUNCTIONS).toHaveProperty('pow')
      expect(MATH_FUNCTIONS).toHaveProperty('min')
      expect(MATH_FUNCTIONS).toHaveProperty('max')
    })

    it('exposes exp4j built-in constants', () => {
      expect(BUILTIN_CONSTANTS.pi).toBe(Math.PI)
      expect(BUILTIN_CONSTANTS['\u03C0']).toBe(Math.PI) // π
      expect(BUILTIN_CONSTANTS.e).toBe(Math.E)
      expect(BUILTIN_CONSTANTS['\u03C6']).toBeCloseTo(1.618, 3) // φ
      expect(BUILTIN_CONSTANTS.PI).toBe(Math.PI)
      expect(BUILTIN_CONSTANTS.E).toBe(Math.E)
    })

    it('BUILTIN_NAMES includes all functions and constants', () => {
      expect(BUILTIN_NAMES.has('abs')).toBe(true)
      expect(BUILTIN_NAMES.has('sin')).toBe(true)
      expect(BUILTIN_NAMES.has('signum')).toBe(true)
      expect(BUILTIN_NAMES.has('pi')).toBe(true)
      expect(BUILTIN_NAMES.has('PI')).toBe(true)
      expect(BUILTIN_NAMES.has('E')).toBe(true)
      expect(BUILTIN_NAMES.has('e')).toBe(true)
      expect(BUILTIN_NAMES.has('x')).toBe(false)
    })
  })

  // ─── extractVariables ─────────────────────────────────────────────

  describe('extractVariables', () => {
    it('extracts simple variables', () => {
      const { variables, error } = extractVariables('x + y')
      expect(error).toBeNull()
      expect(variables).toEqual(expect.arrayContaining(['x', 'y']))
      expect(variables).toHaveLength(2)
    })

    it('excludes built-in function names', () => {
      const { variables } = extractVariables('sqrt(x) + abs(y)')
      expect(variables).toEqual(expect.arrayContaining(['x', 'y']))
      expect(variables).not.toContain('sqrt')
      expect(variables).not.toContain('abs')
    })

    it('excludes new exp4j function names (signum, cbrt, etc.)', () => {
      const { variables } = extractVariables('signum(x) + cbrt(y) + sinh(z)')
      expect(variables).toEqual(expect.arrayContaining(['x', 'y', 'z']))
      expect(variables).not.toContain('signum')
      expect(variables).not.toContain('cbrt')
      expect(variables).not.toContain('sinh')
    })

    it('excludes built-in constants (lowercase and uppercase)', () => {
      const { variables } = extractVariables('PI * r')
      expect(variables).toEqual(['r'])

      const { variables: vars2 } = extractVariables('pi * r')
      expect(vars2).toEqual(['r'])

      const { variables: vars3 } = extractVariables('e * x')
      expect(vars3).toEqual(['x'])
    })

    it('rejects assignment expressions', () => {
      const { variables } = extractVariables('s = x * y')
      expect(variables).toEqual([])
    })

    it('handles empty expression', () => {
      const { variables, error } = extractVariables('')
      expect(variables).toEqual([])
      expect(error).toBeNull()
    })

    it('handles invalid syntax gracefully', () => {
      const { variables, error } = extractVariables('x +* y')
      expect(variables).toEqual([])
      expect(error).toBeNull()
    })

    it('handles nested function calls', () => {
      const { variables } = extractVariables('sqrt(pow(a, 2) + pow(b, 2))')
      expect(variables).toEqual(expect.arrayContaining(['a', 'b']))
      expect(variables).toHaveLength(2)
    })

    it('deduplicates repeated variables', () => {
      const { variables } = extractVariables('x + x + x')
      expect(variables).toEqual(['x'])
    })

    it('handles literal-only expressions', () => {
      const { variables } = extractVariables('2 + 3 * 4')
      expect(variables).toEqual([])
    })

    it('extracts variables from real-world formulas', () => {
      const { variables } = extractVariables('sqrt((x2 - x1)^2 + (y2 - y1)^2)')
      expect(variables).toEqual(
        expect.arrayContaining(['x1', 'x2', 'y1', 'y2'])
      )
      expect(variables).toHaveLength(4)
    })
  })

  // ─── evaluateAst (low-level) ──────────────────────────────────────

  describe('evaluateAst', () => {
    it('evaluates literals', () => {
      expect(evaluateAst(jsep('42'), {})).toBe(42)
    })

    it('evaluates decimal literals', () => {
      expect(evaluateAst(jsep('3.14'), {})).toBeCloseTo(3.14)
    })

    it('evaluates identifiers from scope', () => {
      expect(evaluateAst(jsep('x'), { x: 7 })).toBe(7)
    })

    it('evaluates built-in constants (lowercase)', () => {
      expect(evaluateAst(jsep('pi'), {})).toBe(Math.PI)
      expect(evaluateAst(jsep('e'), {})).toBe(Math.E)
    })

    it('evaluates built-in constants (uppercase)', () => {
      expect(evaluateAst(jsep('PI'), {})).toBe(Math.PI)
      expect(evaluateAst(jsep('E'), {})).toBe(Math.E)
    })

    it('throws on undefined variable', () => {
      expect(() => evaluateAst(jsep('x'), {})).toThrow('Undefined variable: x')
    })

    it('evaluates all binary operators', () => {
      expect(evaluateAst(jsep('3 + 4'), {})).toBe(7)
      expect(evaluateAst(jsep('10 - 3'), {})).toBe(7)
      expect(evaluateAst(jsep('3 * 4'), {})).toBe(12)
      expect(evaluateAst(jsep('10 / 2'), {})).toBe(5)
      expect(evaluateAst(jsep('10 % 3'), {})).toBe(1)
      expect(evaluateAst(jsep('2^3'), {})).toBe(8)
    })

    it('throws on division by zero', () => {
      expect(() => evaluateAst(jsep('1 / 0'), {})).toThrow('Division by zero')
    })

    it('evaluates unary operators', () => {
      expect(evaluateAst(jsep('-5'), {})).toBe(-5)
      expect(evaluateAst(jsep('+5'), {})).toBe(5)
    })

    it('throws on unknown function', () => {
      expect(() => evaluateAst(jsep('unknown(5)'), {})).toThrow(
        'Unknown function'
      )
    })
  })

  // ─── safeEvaluate (public API) ────────────────────────────────────

  describe('safeEvaluate', () => {
    it('throws on invalid syntax', () => {
      expect(() => safeEvaluate('x +* y', { x: 1, y: 2 })).toThrow()
    })

    it('throws on undefined variables', () => {
      expect(() => safeEvaluate('x + y', { x: 1 })).toThrow(
        'Undefined variable: y'
      )
    })

    it('throws on NaN result', () => {
      expect(() => safeEvaluate('sqrt(-1)', {})).toThrow(
        'Formula did not produce a finite number'
      )
    })

    it('throws on Infinity result', () => {
      expect(() => safeEvaluate('exp(1000)', {})).toThrow(
        'Formula did not produce a finite number'
      )
    })
  })

  // ─── Fixture-driven: valid formulas ───────────────────────────────

  describe('valid formulas (fixture-driven)', () => {
    for (const f of VALID_FORMULAS) {
      it(f.label, () => {
        const result = safeEvaluate(f.expression, f.scope)
        if (f.approximate) {
          expect(result).toBeCloseTo(f.expected, 5)
        } else {
          expect(result).toBe(f.expected)
        }
      })
    }
  })

  // ─── Fixture-driven: error formulas ───────────────────────────────

  describe('error formulas (fixture-driven)', () => {
    for (const f of ERROR_FORMULAS) {
      it(`[${f.category}] ${f.label}`, () => {
        if (f.errorContains) {
          expect(() => safeEvaluate(f.expression, f.scope)).toThrow(
            f.errorContains
          )
        } else {
          expect(() => safeEvaluate(f.expression, f.scope)).toThrow()
        }
      })
    }
  })

  // ─── exp4j-specific behavioral tests ──────────────────────────────

  describe('exp4j compatibility', () => {
    it('^ is exponentiation, not XOR', () => {
      // XOR: 2^3 = 1, exponentiation: 2^3 = 8
      expect(safeEvaluate('2^3', {})).toBe(8)
      expect(safeEvaluate('2^10', {})).toBe(1024)
    })

    it('^ is right-associative: 2^3^2 = 2^(3^2) = 512', () => {
      expect(safeEvaluate('2^3^2', {})).toBe(512)
    })

    it('unary minus precedence (known divergence from exp4j)', () => {
      // jsep: -1^2 = (-1)^2 = 1   (unary binds tighter)
      // exp4j: -1^2 = -(1^2) = -1 (^ binds tighter)
      // Users should write -(1^2) for the exp4j interpretation
      expect(safeEvaluate('-1^2', {})).toBe(1)
      expect(safeEvaluate('-(1^2)', {})).toBe(-1)
    })

    it('log is natural log (base e), not base 10', () => {
      expect(safeEvaluate('log(e)', {})).toBeCloseTo(1)
      // If log were base 10, log(e) would be ~0.434
    })

    it('signum matches exp4j (returns -1, 0, or 1)', () => {
      expect(safeEvaluate('signum(-42)', {})).toBe(-1)
      expect(safeEvaluate('signum(0)', {})).toBe(0)
      expect(safeEvaluate('signum(42)', {})).toBe(1)
    })
  })
})
