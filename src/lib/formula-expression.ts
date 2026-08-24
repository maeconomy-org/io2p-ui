// The formula grammar, mirrored from the server.
//
// This is a DELIBERATE mirror of `io2p-core/src/shared/calc.eval.ts` — same library, same pinned
// version, same parser options, same rounding. Not a re-implementation.
//
// The reason is that the client previews a derived value before saving it, so a second evaluator is
// a second answer. The file this replaced was written against `exp4j` — a JAVA library from the
// previous backend — and listed its divergences from it as "known limitations", including that
// `-1^2` parsed differently. Those divergences meant the preview could show a number the server
// would never store: right-looking and wrong, with nothing on screen to say so.
//
// If core bumps its parser pin, its parser options, or `CURRENT_EVAL_VERSION`, this bumps too.
// `formula-expression.test.ts` asserts the alignment rather than trusting this comment.
//
// Moved with core from `expr-eval` (abandoned 2019, no published fix for its two advisories) to
// the `@expr-eval/js` fork — core's `evalVersion` 3. Evaluation is unchanged; the fork additionally
// refuses a function reaching `evaluate` through the scope, which cannot happen here either.

import { Parser, type Expression } from '@expr-eval/js'

/**
 * A MATH-ONLY grammar. Everything disabled here has no place in a pure numeric calc over a
 * numbers-only scope, and each was disabled for a specific failure:
 *
 * - `assignment` — `a = b` parses, extracts `['a','b']` and evaluates to the RHS, so a `==` typo
 *   silently becomes a wrong number with no error.
 * - `fndef` — defining a function inside a value's formula is nonsense here.
 * - `array` — a calc yields ONE number.
 * - `allowMemberAccess` — no numeric use, and the classic sandbox-escape surface.
 */
const PARSER_OPTIONS = {
  operators: { assignment: false, fndef: false, array: false },
  allowMemberAccess: false,
}

const PARSER = new Parser(PARSER_OPTIONS)

/**
 * Reserved: a formula referencing one is rejected at parse.
 *
 * A derived value is re-derived on every rebuild and federated replay must be byte-identical, so a
 * non-deterministic builtin would break integrity rather than merely surprise someone.
 */
const REMOVED_BUILTINS = new Set(['random'])

type Instruction = { type: string; value: unknown }

/**
 * Does the compiled stream contain a `;` sequence?
 *
 * A real sequence compiles to `IENDSTATEMENT`, whereas a conditional `a ? b : c` compiles to `IEXPR`
 * branches without one — so scanning for `IENDSTATEMENT` is precise and does not false-positive on
 * `?:`. Recurses into nested `IEXPR` bodies.
 */
function containsSequence(tokens: readonly Instruction[]): boolean {
  return tokens.some(
    (token) =>
      token.type === 'IENDSTATEMENT' ||
      (token.type === 'IEXPR' &&
        Array.isArray(token.value) &&
        containsSequence(token.value as Instruction[]))
  )
}

/**
 * Parse with the pinned grammar. THROWS on a syntax error, on a `;` sequence, or on a banned
 * builtin — the single chokepoint, so nothing downstream can ever see one.
 *
 * A formula that parses here is one the server will also accept, which is the whole point: the
 * editor cannot show "valid" for something that 422s on save.
 */
export function parseExpression(expression: string): Expression {
  const expr = PARSER.parse(expression)

  // `;` evaluates to only its LAST statement, silently discarding the rest. The tokenizer accepts it
  // unconditionally, so it has to be rejected here rather than by the grammar options.
  if (containsSequence((expr as unknown as { tokens: Instruction[] }).tokens)) {
    throw new Error(
      'formula uses the `;` sequence operator, which is not allowed'
    )
  }

  // `symbols()` lists every referenced name (variables AND called functions); `variables()` excludes
  // builtins, so a banned builtin only shows up in the former.
  const banned = expr.symbols().filter((name) => REMOVED_BUILTINS.has(name))
  if (banned.length > 0) {
    throw new Error(
      `formula uses a non-deterministic builtin: ${banned.join(', ')}`
    )
  }

  return expr
}

/**
 * The free variables an expression references, builtins excluded — the exact set a binding must
 * fill, and byte-identical to the `variables[]` the server derives on create.
 */
export function variablesOf(expression: string): string[] {
  return parseExpression(expression).variables()
}

/** True when the expression is one the server would accept. */
export function isValidExpression(expression: string): boolean {
  try {
    parseExpression(expression)
    return true
  } catch {
    return false
  }
}

/**
 * Core's frozen 12-significant-figure policy.
 *
 * Transcendental functions can differ by a last ULP across platforms, so every result is rounded —
 * which both cleans the number and masks that divergence. Rounding differently here would make the
 * preview disagree with the stored value in the last digits.
 */
export function round(n: number): number {
  return Number(n.toPrecision(12))
}

export type EvalErrorCode = 'div-by-zero' | 'domain' | 'non-numeric-result'

export class FormulaEvalError extends Error {
  constructor(
    readonly code: EvalErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'FormulaEvalError'
  }
}

/**
 * Evaluate against a fully-resolved numeric scope, returning the rounded result.
 *
 * THROWS rather than returning a silent `0`/`NaN` when the top-level result is not a finite number —
 * the same output contract the server holds, so a preview either shows the number the server will
 * store or shows why there isn't one.
 */
export function evaluateExpression(
  expression: string,
  scope: Record<string, number>
): number {
  const result: unknown = parseExpression(expression).evaluate(scope)

  if (typeof result !== 'number') {
    throw new FormulaEvalError(
      'non-numeric-result',
      `formula did not evaluate to a number (got ${typeof result})`
    )
  }
  if (Number.isNaN(result)) {
    throw new FormulaEvalError(
      'domain',
      'formula evaluated to NaN (domain error)'
    )
  }
  if (!Number.isFinite(result)) {
    throw new FormulaEvalError('div-by-zero', 'formula evaluated to Infinity')
  }

  return round(result)
}

/**
 * Names that need a collection to be useful. The `array` grammar is disabled, so there is no way to
 * build an argument for them — offering them would hand the user a formula that cannot be written.
 */
const COLLECTION_ONLY = new Set([
  'filter',
  'fold',
  'map',
  'join',
  'indexOf',
  'length',
])

/** A name callable as `name(x)`, as opposed to a symbolic operator like `!` or `-`. */
const isCallableName = (name: string) => /^[a-z]\w*$/i.test(name)

/**
 * Names the grammar provides, for the expression editor's insert chips and the reference dialog.
 *
 * Read off the parser's OWN tables rather than hand-kept, so a version bump cannot leave the UI
 * documenting functions that no longer exist — the exact drift that made the old exp4j-aligned
 * reference wrong.
 *
 * The parser splits its table: `min`/`max`/`pow` live in `functions`, while `sqrt`/`abs`/`sin` are
 * unary OPERATORS that happen to be call-shaped. Both are equally callable in a formula, so the UI
 * makes no distinction the user would not recognise.
 */
export function builtinNames(): { functions: string[]; constants: string[] } {
  const callable = [
    ...Object.keys(PARSER.functions),
    ...Object.keys(PARSER.unaryOps),
  ]

  const functions = [...new Set(callable)]
    .filter(isCallableName)
    .filter((name) => !REMOVED_BUILTINS.has(name))
    .filter((name) => !COLLECTION_ONLY.has(name))
    .sort()

  // `true`/`false` are booleans; a calc must yield a number, so they are not offered.
  const constants = Object.entries(PARSER.consts)
    .filter(([, value]) => typeof value === 'number')
    .map(([name]) => name)
    .sort()

  return { functions, constants }
}
