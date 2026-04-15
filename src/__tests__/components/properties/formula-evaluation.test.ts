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

describe('formula-evaluation pure functions', () => {
  describe('constants', () => {
    it('exposes expected math functions', () => {
      expect(MATH_FUNCTIONS).toHaveProperty('abs')
      expect(MATH_FUNCTIONS).toHaveProperty('sqrt')
      expect(MATH_FUNCTIONS).toHaveProperty('pow')
      expect(MATH_FUNCTIONS).toHaveProperty('min')
      expect(MATH_FUNCTIONS).toHaveProperty('max')
      expect(MATH_FUNCTIONS).toHaveProperty('ceil')
      expect(MATH_FUNCTIONS).toHaveProperty('floor')
      expect(MATH_FUNCTIONS).toHaveProperty('round')
      expect(MATH_FUNCTIONS).toHaveProperty('log')
      expect(MATH_FUNCTIONS).toHaveProperty('log10')
    })

    it('exposes expected built-in constants', () => {
      expect(BUILTIN_CONSTANTS.PI).toBe(Math.PI)
      expect(BUILTIN_CONSTANTS.E).toBe(Math.E)
    })

    it('BUILTIN_NAMES includes all functions and constants', () => {
      expect(BUILTIN_NAMES.has('abs')).toBe(true)
      expect(BUILTIN_NAMES.has('PI')).toBe(true)
      expect(BUILTIN_NAMES.has('E')).toBe(true)
      expect(BUILTIN_NAMES.has('x')).toBe(false)
    })
  })

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

    it('excludes built-in constants', () => {
      const { variables } = extractVariables('PI * r')
      expect(variables).toEqual(['r'])
    })

    it('rejects assignment expressions', () => {
      const { variables } = extractVariables('s = x * y')
      // jsep may reject `=` as syntax error before our check,
      // either way no variables should be returned
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
      expect(error).toBeNull() // returns empty, no crash
    })

    it('handles nested function calls', () => {
      const { variables } = extractVariables('sqrt(pow(a, 2) + pow(b, 2))')
      expect(variables).toEqual(expect.arrayContaining(['a', 'b']))
      expect(variables).toHaveLength(2)
    })

    it('handles conditional expressions', () => {
      const { variables } = extractVariables('x > 0 ? x : y')
      expect(variables).toEqual(expect.arrayContaining(['x', 'y']))
    })

    it('deduplicates repeated variables', () => {
      const { variables } = extractVariables('x + x + x')
      expect(variables).toEqual(['x'])
    })

    it('handles literal-only expressions', () => {
      const { variables } = extractVariables('2 + 3 * 4')
      expect(variables).toEqual([])
    })
  })

  describe('evaluateAst', () => {
    it('evaluates literals', () => {
      const ast = jsep('42')
      expect(evaluateAst(ast, {})).toBe(42)
    })

    it('evaluates identifiers from scope', () => {
      const ast = jsep('x')
      expect(evaluateAst(ast, { x: 7 })).toBe(7)
    })

    it('evaluates built-in constants', () => {
      const ast = jsep('PI')
      expect(evaluateAst(ast, {})).toBe(Math.PI)
    })

    it('throws on undefined variable', () => {
      const ast = jsep('x')
      expect(() => evaluateAst(ast, {})).toThrow('Undefined variable: x')
    })

    it('evaluates binary operations', () => {
      expect(evaluateAst(jsep('3 + 4'), {})).toBe(7)
      expect(evaluateAst(jsep('10 - 3'), {})).toBe(7)
      expect(evaluateAst(jsep('3 * 4'), {})).toBe(12)
      expect(evaluateAst(jsep('10 / 2'), {})).toBe(5)
      expect(evaluateAst(jsep('10 % 3'), {})).toBe(1)
      expect(evaluateAst(jsep('2 ** 3'), {})).toBe(8)
    })

    it('returns NaN for division by zero', () => {
      expect(evaluateAst(jsep('1 / 0'), {})).toBeNaN()
    })

    it('evaluates unary operators', () => {
      expect(evaluateAst(jsep('-5'), {})).toBe(-5)
      expect(evaluateAst(jsep('+5'), {})).toBe(5)
    })

    it('evaluates function calls', () => {
      expect(evaluateAst(jsep('sqrt(16)'), {})).toBe(4)
      expect(evaluateAst(jsep('abs(-5)'), {})).toBe(5)
      expect(evaluateAst(jsep('min(3, 7)'), {})).toBe(3)
      expect(evaluateAst(jsep('max(3, 7)'), {})).toBe(7)
      expect(evaluateAst(jsep('pow(2, 3)'), {})).toBe(8)
    })

    it('throws on unknown function', () => {
      const ast = jsep('unknown(5)')
      expect(() => evaluateAst(ast, {})).toThrow('Unknown function')
    })

    it('evaluates conditional expressions', () => {
      // jsep doesn't parse ternary by default, but test structure
      const ast = jsep('1 ? 10 : 20')
      expect(evaluateAst(ast, {})).toBe(10)
    })
  })

  describe('safeEvaluate', () => {
    it('evaluates simple expressions', () => {
      expect(safeEvaluate('2 + 3', {})).toBe(5)
      expect(safeEvaluate('10 * 5', {})).toBe(50)
    })

    it('evaluates with scope variables', () => {
      expect(safeEvaluate('x + y', { x: 3, y: 7 })).toBe(10)
      expect(safeEvaluate('x * y + 1', { x: 4, y: 5 })).toBe(21)
    })

    it('evaluates complex expressions', () => {
      expect(safeEvaluate('sqrt(pow(a, 2) + pow(b, 2))', { a: 3, b: 4 })).toBe(
        5
      )
    })

    it('evaluates with built-in constants', () => {
      expect(safeEvaluate('PI * pow(r, 2)', { r: 1 })).toBeCloseTo(Math.PI, 10)
    })

    it('throws on invalid syntax', () => {
      expect(() => safeEvaluate('x +* y', { x: 1, y: 2 })).toThrow()
    })

    it('throws on undefined variables', () => {
      expect(() => safeEvaluate('x + y', { x: 1 })).toThrow(
        'Undefined variable: y'
      )
    })
  })
})
