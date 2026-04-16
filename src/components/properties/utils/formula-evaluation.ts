import jsep from 'jsep'
import type { Expression } from 'jsep'

/**
 * Pure functions for formula parsing, variable extraction, and evaluation.
 * Uses jsep (~6KB) for safe expression parsing and a custom evaluator.
 *
 * ALIGNED WITH BACKEND exp4j (net.objecthunter.exp4j):
 * - ^ means exponentiation (not XOR)
 * - Supported operators: +, -, *, /, %, ^, unary +, unary -
 * - No bitwise, comparison, logical, or ternary operators
 *
 * KNOWN LIMITATIONS vs backend exp4j:
 * - No implicit multiplication: use "2*x" not "2x", "2*cos(x)" not "2cos(x)"
 * - No factorial operator (!)
 * - Custom backend functions/operators must be registered here manually
 * - Scientific notation "1e5" works but conflicts with constant "e" are possible
 * - Unary minus precedence: jsep parses -1^2 as (-1)^2=1, exp4j as -(1^2)=-1
 *   Users should write -(1^2) explicitly when needed
 */

// --- jsep configuration: align operator set with exp4j ---

// Make ^ mean exponentiation (exp4j semantics), not XOR
jsep.removeBinaryOp('^')
jsep.addBinaryOp('^', 11, true) // high precedence, right-associative

// Remove operators that exp4j does not support
// Prevents formulas that validate on frontend but fail on backend
;[
  '>>>',
  '>>',
  '<<',
  '|',
  '&',
  '===',
  '!==',
  '==',
  '!=',
  '||',
  '&&',
  '<=',
  '>=',
  '<',
  '>',
].forEach((op) => jsep.removeBinaryOp(op))
jsep.removeUnaryOp('~')
jsep.removeUnaryOp('!')

// Built-in math functions supported in formulas (matches exp4j built-ins)
export const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  cbrt: Math.cbrt,
  ceil: Math.ceil,
  cos: Math.cos,
  cosh: Math.cosh,
  exp: Math.exp,
  floor: Math.floor,
  log: Math.log, // natural log, base e (matches exp4j)
  log2: Math.log2,
  log10: Math.log10,
  sin: Math.sin,
  sinh: Math.sinh,
  sqrt: Math.sqrt,
  tan: Math.tan,
  tanh: Math.tanh,
  signum: Math.sign,
  // Kept for backward compatibility with existing formulas.
  // ⚠️ Verify with backend team: confirm whether round, pow, min, max are
  // registered as custom functions on the backend ExpressionBuilder.
  // If not, REMOVE these four.
  round: Math.round,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
}

// Built-in constants (matches exp4j: pi, π, e, φ)
export const BUILTIN_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  '\u03C0': Math.PI, // π
  e: Math.E,
  '\u03C6': 1.61803398874, // φ (golden ratio)
  // Keep uppercase aliases for backward compatibility with existing formulas
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
          if (right === 0) throw new Error('Division by zero')
          return left / right
        case '%':
          return left % right
        case '^':
          return Math.pow(left, right)
        case '**':
          return Math.pow(left, right) // backward compat alias
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
    // ConditionalExpression (ternary) intentionally unsupported — exp4j has no ternary
    default:
      throw new Error(`Unsupported expression type: ${node.type}`)
  }
}

/**
 * Parse and evaluate a formula string with the given scope.
 * Throws if the result is NaN or Infinity (matching exp4j's throwing behavior).
 */
export function safeEvaluate(
  expression: string,
  scope: Record<string, number>
): number {
  const ast = jsep(expression)
  const result = evaluateAst(ast, scope)
  if (!Number.isFinite(result)) {
    throw new Error(`Formula did not produce a finite number (got ${result})`)
  }
  return result
}
