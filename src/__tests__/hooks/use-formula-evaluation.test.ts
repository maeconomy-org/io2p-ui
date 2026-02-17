import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  useFormulaEvaluation,
  type AvailableProperty,
} from '@/components/properties/hooks/use-formula-evaluation'

const makeProps = (
  overrides: Partial<AvailableProperty>[] = []
): AvailableProperty[] =>
  overrides.map((o, i) => ({
    uuid: `prop-${i}::0`,
    key: `prop${i}`,
    label: `Prop ${i}`,
    value: '10',
    ...o,
  }))

describe('useFormulaEvaluation', () => {
  // ─── Basic formula parsing ───────────────────────────────────────

  it('starts with empty state', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    expect(result.current.formula).toBe('')
    expect(result.current.detectedVariables).toEqual([])
    expect(result.current.evaluation.isValid).toBe(false)
    expect(result.current.evaluation.result).toBeNull()
    expect(result.current.evaluation.error).toBeNull()
  })

  it('detects variables from a formula', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('x + y'))
    expect(result.current.detectedVariables).toEqual(
      expect.arrayContaining(['x', 'y'])
    )
    expect(result.current.detectedVariables).toHaveLength(2)
  })

  it('excludes built-in functions from variables', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('sqrt(x) + abs(y)'))
    expect(result.current.detectedVariables).toEqual(
      expect.arrayContaining(['x', 'y'])
    )
    expect(result.current.detectedVariables).not.toContain('sqrt')
    expect(result.current.detectedVariables).not.toContain('abs')
  })

  it('excludes built-in constants (PI, E) from variables', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('PI * r'))
    expect(result.current.detectedVariables).toEqual(['r'])
  })

  it('rejects assignment expressions', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('s = x * y'))
    // jsep may reject the `=` as a syntax error before our custom check
    expect(result.current.evaluation.error).toBeTruthy()
  })

  // ─── Evaluation ──────────────────────────────────────────────────

  it('evaluates a simple formula with mapped variables', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'width', value: '5' },
      { uuid: 'b::0', key: 'height', value: '3' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x * y'))
    act(() => result.current.mapVariable('x', 'width', 'a::0'))
    act(() => result.current.mapVariable('y', 'height', 'b::0'))

    expect(result.current.evaluation.isValid).toBe(true)
    expect(result.current.evaluation.result).toBe(15)
    expect(result.current.evaluation.error).toBeNull()
  })

  it('evaluates formulas with built-in functions', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'x', value: '16' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('sqrt(x)'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))

    expect(result.current.evaluation.result).toBe(4)
  })

  it('evaluates formulas with built-in constants', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'r', value: '1' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('PI * pow(r, 2)'))
    act(() => result.current.mapVariable('r', 'r', 'a::0'))

    expect(result.current.evaluation.result).toBeCloseTo(Math.PI, 4)
  })

  it('handles division by zero gracefully', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'x', value: '10' },
      { uuid: 'b::0', key: 'y', value: '0' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x / y'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    act(() => result.current.mapVariable('y', 'y', 'b::0'))

    // NaN result → null
    expect(result.current.evaluation.result).toBeNull()
  })

  it('returns null result when not all variables are mapped', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'x', value: '5' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + y'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))

    // y is not mapped
    expect(result.current.evaluation.result).toBeNull()
    expect(result.current.evaluation.error).toBeNull() // no error, just unmapped
  })

  // ─── Non-numeric values ──────────────────────────────────────────

  it('reports non-numeric values with variable names', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'name', value: 'hello' },
      { uuid: 'b::0', key: 'count', value: '5' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + y'))
    act(() => result.current.mapVariable('x', 'name', 'a::0'))
    act(() => result.current.mapVariable('y', 'count', 'b::0'))

    expect(result.current.evaluation.result).toBeNull()
    expect(result.current.evaluation.error).toContain('Non-numeric')
    expect(result.current.evaluation.error).toContain('name')
  })

  it('handles empty string values as non-numeric', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'empty', value: '' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + 1'))
    act(() => result.current.mapVariable('x', 'empty', 'a::0'))

    expect(result.current.evaluation.result).toBeNull()
  })

  // ─── Multi-value properties (composite IDs) ─────────────────────

  it('resolves different values from the same property via composite IDs', () => {
    const props: AvailableProperty[] = [
      { uuid: 'prop1::0', key: 'Floors', value: '22', valueIndex: 0 },
      { uuid: 'prop1::1', key: 'Floors', value: '33', valueIndex: 1 },
      { uuid: 'prop1::2', key: 'Floors', value: '108', valueIndex: 2 },
    ]
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + y'))
    act(() => result.current.mapVariable('x', 'Floors', 'prop1::0'))
    act(() => result.current.mapVariable('y', 'Floors', 'prop1::1'))

    expect(result.current.evaluation.result).toBe(55) // 22 + 33
  })

  it('resolves mixed properties and multi-values', () => {
    const props: AvailableProperty[] = [
      { uuid: 'prop1::0', key: 'Width', value: '10', valueIndex: 0 },
      { uuid: 'prop2::0', key: 'Height', value: '5', valueIndex: 0 },
      { uuid: 'prop2::1', key: 'Height', value: '8', valueIndex: 1 },
    ]
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('w * h'))
    act(() => result.current.mapVariable('w', 'Width', 'prop1::0'))
    act(() => result.current.mapVariable('h', 'Height', 'prop2::1'))

    expect(result.current.evaluation.result).toBe(80) // 10 * 8
  })

  // ─── Resolved expression ─────────────────────────────────────────

  it('builds a resolved expression string', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'x', value: '3' },
      { uuid: 'b::0', key: 'y', value: '7' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + y'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    act(() => result.current.mapVariable('y', 'y', 'b::0'))

    expect(result.current.evaluation.resolvedExpression).toBe('3 + 7')
  })

  // ─── setFormulaWithMapping ────────────────────────────────────────

  it('initializes formula and mapping together', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'x', value: '4' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() =>
      result.current.setFormulaWithMapping('x * 2', {
        x: { propertyKey: 'x', propertyUuid: 'a::0' },
      })
    )

    expect(result.current.formula).toBe('x * 2')
    expect(result.current.evaluation.result).toBe(8)
  })

  // ─── Reset ────────────────────────────────────────────────────────

  it('resets all state', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'x', value: '5' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x + 1'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    expect(result.current.evaluation.result).toBe(6)

    act(() => result.current.reset())
    expect(result.current.formula).toBe('')
    expect(result.current.detectedVariables).toEqual([])
    expect(result.current.evaluation.result).toBeNull()
  })

  // ─── Syntax errors ────────────────────────────────────────────────

  it('reports syntax errors for invalid formulas', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('x +* y'))
    expect(result.current.evaluation.error).toBeTruthy()
  })

  // ─── Advanced formulas ────────────────────────────────────────────

  it('evaluates nested function calls', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'a', value: '3' },
      { uuid: 'b::0', key: 'b', value: '4' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('sqrt(pow(a, 2) + pow(b, 2))'))
    act(() => result.current.mapVariable('a', 'a', 'a::0'))
    act(() => result.current.mapVariable('b', 'b', 'b::0'))

    expect(result.current.evaluation.result).toBe(5) // 3-4-5 triangle
  })

  it('evaluates min/max functions', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'x', value: '7' },
      { uuid: 'b::0', key: 'y', value: '3' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('min(x, y)'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    act(() => result.current.mapVariable('y', 'y', 'b::0'))

    expect(result.current.evaluation.result).toBe(3)
  })

  it('evaluates unary negation', () => {
    const props = makeProps([{ uuid: 'a::0', key: 'x', value: '5' }])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('-x'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))

    expect(result.current.evaluation.result).toBe(-5)
  })

  it('evaluates modulo operator', () => {
    const props = makeProps([
      { uuid: 'a::0', key: 'x', value: '10' },
      { uuid: 'b::0', key: 'y', value: '3' },
    ])
    const { result } = renderHook(() => useFormulaEvaluation(props))

    act(() => result.current.setFormula('x % y'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    act(() => result.current.mapVariable('y', 'y', 'b::0'))

    expect(result.current.evaluation.result).toBe(1)
  })

  it('evaluates literal-only formulas without variables', () => {
    const { result } = renderHook(() => useFormulaEvaluation([]))
    act(() => result.current.setFormula('2 + 3 * 4'))

    expect(result.current.detectedVariables).toEqual([])
    expect(result.current.evaluation.result).toBe(14)
  })

  // ─── Reactivity ───────────────────────────────────────────────────

  it('re-evaluates when availableProperties change', () => {
    const initial: AvailableProperty[] = [
      { uuid: 'a::0', key: 'x', value: '5' },
    ]
    const { result, rerender } = renderHook(
      ({ props }) => useFormulaEvaluation(props),
      { initialProps: { props: initial } }
    )

    act(() => result.current.setFormula('x * 2'))
    act(() => result.current.mapVariable('x', 'x', 'a::0'))
    expect(result.current.evaluation.result).toBe(10)

    // Simulate property value changing
    const updated: AvailableProperty[] = [
      { uuid: 'a::0', key: 'x', value: '8' },
    ]
    rerender({ props: updated })

    expect(result.current.evaluation.result).toBe(16)
  })
})
