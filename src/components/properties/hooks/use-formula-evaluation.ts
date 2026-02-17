import { useState, useCallback, useMemo } from 'react'
import jsep from 'jsep'
import type { Expression } from 'jsep'

export interface FormulaVariable {
  name: string
  propertyKey: string
  propertyUuid: string
  resolvedValue: number | null
}

export interface FormulaEvaluationResult {
  isValid: boolean
  result: number | null
  resolvedExpression: string
  error: string | null
}

export interface AvailableProperty {
  uuid: string // Composite ID: "propertyId::valueIndex" for unique selection
  key: string
  label?: string
  value: string
  valueIndex?: number
}

// Built-in math functions supported in formulas
const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sqrt: Math.sqrt,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  log: Math.log,
  log10: Math.log10,
}

// Built-in constants (not user variables)
const BUILTIN_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
}

const BUILTIN_NAMES = new Set([
  ...Object.keys(MATH_FUNCTIONS),
  ...Object.keys(BUILTIN_CONSTANTS),
])

/**
 * Extract user-defined variable names from a jsep AST.
 * Excludes built-in function names and constants.
 * Rejects assignment-like expressions (e.g. `s = x * y` is invalid).
 */
function extractVariables(expression: string): {
  variables: string[]
  error: string | null
} {
  try {
    const ast = jsep(expression)

    // Reject assignment expressions — formulas must be pure expressions
    if (ast.type === 'AssignmentExpression' || expression.includes('=')) {
      return {
        variables: [],
        error: 'Assignments are not allowed. Use a pure expression like x * y',
      }
    }

    const symbols = new Set<string>()

    function walk(node: Expression) {
      if (!node) return
      switch (node.type) {
        case 'Identifier':
          if (!BUILTIN_NAMES.has((node as any).name)) {
            symbols.add((node as any).name)
          }
          break
        case 'BinaryExpression':
        case 'LogicalExpression':
          walk((node as any).left)
          walk((node as any).right)
          break
        case 'UnaryExpression':
          walk((node as any).argument)
          break
        case 'CallExpression':
          // Don't add function name as variable, but walk arguments
          ;((node as any).arguments || []).forEach(walk)
          break
        case 'ConditionalExpression':
          walk((node as any).test)
          walk((node as any).consequent)
          walk((node as any).alternate)
          break
        case 'MemberExpression':
          walk((node as any).object)
          break
        case 'ArrayExpression':
          ;((node as any).elements || []).forEach(walk)
          break
        case 'Compound':
          ;((node as any).body || []).forEach(walk)
          break
        // Literal — no variables
        default:
          break
      }
    }

    walk(ast)
    return { variables: Array.from(symbols), error: null }
  } catch {
    return { variables: [], error: null }
  }
}

/**
 * Evaluate a jsep AST node with a given scope.
 */
function evaluateAst(node: Expression, scope: Record<string, number>): number {
  switch (node.type) {
    case 'Literal':
      return Number((node as any).value)
    case 'Identifier': {
      const name = (node as any).name
      if (name in BUILTIN_CONSTANTS) return BUILTIN_CONSTANTS[name]
      if (name in scope) return scope[name]
      throw new Error(`Undefined variable: ${name}`)
    }
    case 'UnaryExpression': {
      const arg = evaluateAst((node as any).argument, scope)
      switch ((node as any).operator) {
        case '-':
          return -arg
        case '+':
          return +arg
        case '!':
          return arg ? 0 : 1
        default:
          throw new Error(`Unknown unary operator: ${(node as any).operator}`)
      }
    }
    case 'BinaryExpression': {
      const left = evaluateAst((node as any).left, scope)
      const right = evaluateAst((node as any).right, scope)
      switch ((node as any).operator) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          return right === 0 ? NaN : left / right
        case '%':
          return left % right
        case '**':
          return Math.pow(left, right)
        default:
          throw new Error(`Unknown binary operator: ${(node as any).operator}`)
      }
    }
    case 'CallExpression': {
      const callee = (node as any).callee
      const fnName = callee.type === 'Identifier' ? callee.name : null
      if (!fnName || !(fnName in MATH_FUNCTIONS)) {
        throw new Error(`Unknown function: ${fnName}`)
      }
      const args = ((node as any).arguments || []).map((a: Expression) =>
        evaluateAst(a, scope)
      )
      return MATH_FUNCTIONS[fnName](...args)
    }
    case 'ConditionalExpression': {
      const test = evaluateAst((node as any).test, scope)
      return test
        ? evaluateAst((node as any).consequent, scope)
        : evaluateAst((node as any).alternate, scope)
    }
    default:
      throw new Error(`Unsupported expression type: ${node.type}`)
  }
}

/**
 * Parse and evaluate a formula string with the given scope.
 */
function safeEvaluate(
  expression: string,
  scope: Record<string, number>
): number {
  const ast = jsep(expression)
  return evaluateAst(ast, scope)
}

/**
 * Hook for formula parsing, variable detection, and evaluation.
 * Uses jsep (~6KB) for safe expression parsing and a custom evaluator.
 */
export function useFormulaEvaluation(availableProperties: AvailableProperty[]) {
  const [formula, setFormula] = useState('')
  const [variableMapping, setVariableMapping] = useState<
    Record<string, { propertyKey: string; propertyUuid: string }>
  >({})

  // Detect variables from the formula expression
  const parseResult = useMemo(() => {
    if (!formula.trim()) return { variables: [] as string[], error: null }
    return extractVariables(formula)
  }, [formula])

  const detectedVariables = parseResult.variables

  // Resolve variable values from mapped properties
  const resolvedVariables = useMemo((): FormulaVariable[] => {
    return detectedVariables.map((varName) => {
      const mapping = variableMapping[varName]
      if (!mapping) {
        return {
          name: varName,
          propertyKey: '',
          propertyUuid: '',
          resolvedValue: null,
        }
      }

      // Find the property value by UUID (supports composite IDs like "propId::0")
      const prop = availableProperties.find(
        (p) => p.uuid === mapping.propertyUuid
      )

      const numValue = prop?.value ? parseFloat(prop.value) : null

      return {
        name: varName,
        propertyKey: mapping.propertyKey,
        propertyUuid: mapping.propertyUuid,
        resolvedValue: isNaN(numValue as number) ? null : numValue,
      }
    })
  }, [detectedVariables, variableMapping, availableProperties])

  // Evaluate the formula with resolved values
  const evaluation = useMemo((): FormulaEvaluationResult => {
    if (!formula.trim()) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: null,
      }
    }

    // Check for assignment rejection
    if (parseResult.error) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: parseResult.error,
      }
    }

    // Check if formula parses
    try {
      jsep(formula)
    } catch (e: any) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: e.message || 'Invalid formula syntax',
      }
    }

    // Check if all variables are mapped and have values
    const allMapped = resolvedVariables.every((v) => v.propertyKey !== '')
    const allResolved = resolvedVariables.every((v) => v.resolvedValue !== null)

    // Build resolved expression string
    let resolvedExpression = formula
    resolvedVariables.forEach((v) => {
      if (v.resolvedValue !== null) {
        resolvedExpression = resolvedExpression.replace(
          new RegExp(`\\b${v.name}\\b`, 'g'),
          String(v.resolvedValue)
        )
      }
    })

    if (!allMapped) {
      return {
        isValid: true,
        result: null,
        resolvedExpression,
        error: null,
      }
    }

    if (!allResolved) {
      // Identify which variables have non-numeric values
      const nonNumeric = resolvedVariables
        .filter((v) => v.propertyKey && v.resolvedValue === null)
        .map((v) => `${v.name} → "${v.propertyKey}"`)
      return {
        isValid: true,
        result: null,
        resolvedExpression,
        error:
          nonNumeric.length > 0
            ? `Non-numeric values: ${nonNumeric.join(', ')}`
            : 'Some mapped properties have non-numeric values',
      }
    }

    // Evaluate with custom evaluator
    try {
      const scope: Record<string, number> = {}
      resolvedVariables.forEach((v) => {
        if (v.resolvedValue !== null) {
          scope[v.name] = v.resolvedValue
        }
      })
      const result = safeEvaluate(formula, scope)

      return {
        isValid: true,
        result: typeof result === 'number' && !isNaN(result) ? result : null,
        resolvedExpression,
        error: null,
      }
    } catch (e: any) {
      return {
        isValid: false,
        result: null,
        resolvedExpression,
        error: e.message || 'Evaluation error',
      }
    }
  }, [formula, resolvedVariables, parseResult.error])

  // Map a variable to a property value (propertyUuid may be a composite ID like "propId::0")
  const mapVariable = useCallback(
    (variableName: string, propertyKey: string, propertyUuid: string) => {
      setVariableMapping((prev) => ({
        ...prev,
        [variableName]: { propertyKey, propertyUuid },
      }))
    },
    []
  )

  // Reset all state
  const reset = useCallback(() => {
    setFormula('')
    setVariableMapping({})
  }, [])

  // Set formula and optionally pre-fill variable mapping
  const setFormulaWithMapping = useCallback(
    (
      newFormula: string,
      mapping?: Record<string, { propertyKey: string; propertyUuid: string }>
    ) => {
      setFormula(newFormula)
      if (mapping) {
        setVariableMapping(mapping)
      }
    },
    []
  )

  return {
    formula,
    setFormula,
    setFormulaWithMapping,
    detectedVariables,
    resolvedVariables,
    variableMapping,
    mapVariable,
    evaluation,
    reset,
  }
}
