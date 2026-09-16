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
 * MIRRORED VERBATIM from `io2p-core/src/shared/calc.eval.ts` (`inheritanceSafe` … `callTaint`),
 * the same way the grammar above mirrors the evaluator. The preview has to decide whether a
 * declared result unit converts the number or only names it, and that verdict must be the node's
 * own — a second reading of the rule is a second answer, which is what this file exists to prevent.
 *
 * Re-copy it whenever core's walk moves. It has already moved once, from a `scaleFree` that asked
 * whether a scalar had touched a property to a `keepsArgDimension` that asks only whether the
 * result still carries the args' dimension — a rename would not have caught that.
 */
// ── Unit-inheritance safety (the scalar-aware taint walk) ─────────────────────────────
// Can this expression's result meaningfully CARRY the unit of its property arguments?
// Decided structurally, by simulating the evaluator's stack over the compiled instruction
// stream (the same `.tokens` access `containsSequence` uses) and marking each slot either
// TAINTED (carries a property variable) or SCALAR (a number literal, an embedded constant —
// unit-transparent by decision). The rules mirror dimensional analysis, conservatively:
//   • `+`, binary `-`, `min`/`max` — legal between two tainted or two scalar operands
//     MIXING them (`a + 500`, `min(a, 100)`, `a + offset`) fails the walk: an additive bare
//     number is a dimensioned quantity in disguise (500 *what*?), unlike a multiplicative
//     scalar, which is a genuine ratio. A bare number thus behaves identically whether it
//     arrives as a literal, an embedded constant, or a unitless sibling (the fold's
//     mixed-args rule).
//   • unary `-` — passes taint through.
//   • `*` — legal with at most ONE tainted operand (`a * 2`, `a * co2factor` inherit
//     `a * b` over two properties does not — kg × kg is not kg).
//   • `/` — legal only when the DIVISOR is scalar (`a / 2` inherits; `2 / a` inverts the
//     dimension).
//   • `^`, any other function/operator, any unrecognized instruction — not safe.
// A bail means "no inheritance", never a wrong unit. `propertyVars` = the variables bound
// to sibling PROPERTIES (constants are scalars). Pure; returns false on any parse failure
// (the fold must stay total — its caller has already evaluated successfully anyway).
export function inheritanceSafe(
  expression: string,
  propertyVars: ReadonlySet<string>
): boolean {
  return taintWalk(expression, propertyVars, false) !== null
}

// Does the result keep the one dimension of its unit-bearing args (`unitVars`)? The same walk,
// except a bare number in an additive position (`a + 500`, `max(a, 0)`) passes: the args are
// canonical, so the number is read in the canonical unit too — as a unitless sibling is.
// Unitless siblings and constants are scalars here, so `a * n` and `(a + b) / 2` keep it.
export function keepsArgDimension(
  expression: string,
  unitVars: ReadonlySet<string>
): boolean {
  return taintWalk(expression, unitVars, true)?.taint === true
}

function taintWalk(
  expression: string,
  propertyVars: ReadonlySet<string>,
  additiveScalars: boolean
): TaintSlot | null {
  let tokens: readonly Instruction[]
  try {
    tokens = (
      parseExpression(expression) as unknown as { tokens: Instruction[] }
    ).tokens
  } catch {
    return null
  }

  const stack: TaintSlot[] = []
  for (const token of tokens) {
    if (!stepTaint(stack, token, propertyVars, additiveScalars)) {
      return null
    }
  }
  return stack.length === 1 ? stack[0]! : null
}

// One stack slot: does it carry a property variable? `name` is kept so a function pushed via
// IVAR ('min') can be recognized when its IFUNCALL pops it.
type TaintSlot = { taint: boolean; name?: string }

// Apply ONE instruction to the simulated stack. `false` means the expression is not safe —
// including any instruction the walk does not model, which must refuse rather than be skipped.
function stepTaint(
  stack: TaintSlot[],
  token: Instruction,
  propertyVars: ReadonlySet<string>,
  additiveScalars: boolean
): boolean {
  switch (token.type) {
    case 'INUMBER': {
      stack.push({ taint: false })
      return true
    }
    case 'IVAR': {
      const name = String(token.value)
      stack.push({ taint: propertyVars.has(name), name })
      return true
    }
    case 'IOP1': {
      // Unary minus negates the quantity but keeps its dimension — taint passes through
      // untouched. Everything else (`not`, the unary-op function forms) bails.
      return token.value === '-' && stack.length > 0
    }
    case 'IOP2': {
      const b = stack.pop()
      const a = stack.pop()
      return pushIfSafe(
        stack,
        a && b ? binaryTaint(token.value, a, b, additiveScalars) : null
      )
    }
    case 'IFUNCALL': {
      return pushIfSafe(stack, callTaint(stack, token.value, additiveScalars))
    }
    default: {
      return false
    }
  }
}

function pushIfSafe(stack: TaintSlot[], slot: TaintSlot | null): boolean {
  if (!slot) {
    return false
  }
  stack.push(slot)
  return true
}

// The binary operators the walk models, or `null` for "not safe".
function binaryTaint(
  op: unknown,
  a: TaintSlot,
  b: TaintSlot,
  additiveScalars: boolean
): TaintSlot | null {
  switch (op) {
    case '+':
    case '-': {
      return a.taint === b.taint || additiveScalars
        ? { taint: a.taint || b.taint }
        : null
    }
    case '*': {
      return a.taint && b.taint ? null : { taint: a.taint || b.taint }
    }
    case '/': {
      return b.taint ? null : { taint: a.taint }
    }
    default: {
      return null
    }
  }
}

// A function call, or `null` for "not safe". The evaluator pops `argCount` args, then the
// function slot (pushed by IVAR). Only min/max are modelled.
function callTaint(
  stack: TaintSlot[],
  argCount: unknown,
  additiveScalars: boolean
): TaintSlot | null {
  const count = typeof argCount === 'number' ? argCount : -1
  if (count < 1 || stack.length < count + 1) {
    return null
  }
  const args = stack.splice(stack.length - count, count)
  const fn = stack.pop()
  if (!fn || (fn.name !== 'min' && fn.name !== 'max')) {
    return null
  }
  // min/max are order statistics — additive-family: all-tainted or all-scalar.
  const taint = args.some((arg) => arg.taint)
  if (!additiveScalars && args.some((arg) => arg.taint !== taint)) {
    return null
  }
  return { taint }
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
