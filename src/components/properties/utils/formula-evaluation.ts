import jsep from 'jsep'
import type { Expression } from 'jsep'

/**
 * Pure functions for formula parsing, variable extraction, and evaluation.
 * Uses jsep (~6KB) for safe expression parsing and a custom evaluator.
 */

// Built-in math functions supported in formulas
export const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
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
export const BUILTIN_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
}

export const BUILTIN_NAMES = new Set([
  ...Object.keys(MATH_FUNCTIONS),
  ...Object.keys(BUILTIN_CONSTANTS),
])

/**
 * Extract user-defined variable names from a jsep AST.
 * Excludes built-in function names and constants.
 * Rejects assignment-like expressions (e.g. `s = x * y` is invalid).
 */
export function extractVariables(expression: string): {
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
export function evaluateAst(
  node: Expression,
  scope: Record<string, number>
): number {
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
export function safeEvaluate(
  expression: string,
  scope: Record<string, number>
): number {
  const ast = jsep(expression)
  return evaluateAst(ast, scope)
}
