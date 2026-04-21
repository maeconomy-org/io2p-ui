/**
 * Formula test fixtures — shared between unit tests and manual QA.
 *
 * Each fixture represents a formula that a user might type in the UI.
 * The expected result must match what the Java backend (exp4j) produces.
 *
 * Categories:
 *   VALID   — should evaluate to the expected numeric result
 *   ERROR   — should throw (parse error, runtime error, or non-finite result)
 */

// ---------------------------------------------------------------------------
// Valid formulas — each must produce the expected result
// ---------------------------------------------------------------------------

export interface ValidFormula {
  /** Human-readable label for test output */
  label: string
  /** The formula string as a user would type it */
  expression: string
  /** Variable values to inject */
  scope: Record<string, number>
  /** Expected numeric result (use `closeTo` for floats) */
  expected: number
  /** If true, use toBeCloseTo instead of toBe */
  approximate?: boolean
}

export const VALID_FORMULAS: ValidFormula[] = [
  // --- Basic arithmetic ---
  {
    label: 'addition',
    expression: '2 + 3',
    scope: {},
    expected: 5,
  },
  {
    label: 'subtraction',
    expression: '10 - 4',
    scope: {},
    expected: 6,
  },
  {
    label: 'multiplication',
    expression: '6 * 7',
    scope: {},
    expected: 42,
  },
  {
    label: 'division',
    expression: '20 / 4',
    scope: {},
    expected: 5,
  },
  {
    label: 'modulo',
    expression: '17 % 5',
    scope: {},
    expected: 2,
  },
  {
    label: 'exponentiation with ^',
    expression: '2^10',
    scope: {},
    expected: 1024,
  },
  {
    label: 'operator precedence (* before +)',
    expression: '2 + 3 * 4',
    scope: {},
    expected: 14,
  },
  {
    label: 'parentheses override precedence',
    expression: '(2 + 3) * 4',
    scope: {},
    expected: 20,
  },
  {
    label: 'nested parentheses',
    expression: '((2 + 3) * (4 - 1))',
    scope: {},
    expected: 15,
  },

  // --- Decimals ---
  {
    label: 'decimal literals',
    expression: '0.5 + 1.5',
    scope: {},
    expected: 2,
  },
  {
    label: 'decimal multiplication',
    expression: '3.14 * 2',
    scope: {},
    expected: 6.28,
    approximate: true,
  },
  {
    label: 'small decimals',
    expression: '0.001 * 1000',
    scope: {},
    expected: 1,
  },

  // --- Unary operators ---
  {
    label: 'unary minus on literal',
    expression: '-5',
    scope: {},
    expected: -5,
  },
  {
    label: 'unary plus on literal',
    expression: '+5',
    scope: {},
    expected: 5,
  },
  {
    label: 'unary minus on variable',
    expression: '-x',
    scope: { x: 3 },
    expected: -3,
  },
  {
    label: 'double unary minus',
    expression: '--x',
    scope: { x: 7 },
    expected: 7,
  },

  // --- Variables ---
  {
    label: 'single variable',
    expression: 'x',
    scope: { x: 42 },
    expected: 42,
  },
  {
    label: 'two variables',
    expression: 'width * height',
    scope: { width: 10, height: 5 },
    expected: 50,
  },
  {
    label: 'variable with negative value',
    expression: 'x + y',
    scope: { x: -3, y: 10 },
    expected: 7,
  },
  {
    label: 'variable in function',
    expression: 'sqrt(x)',
    scope: { x: 144 },
    expected: 12,
  },
  {
    label: 'zero variable value',
    expression: 'x + 1',
    scope: { x: 0 },
    expected: 1,
  },

  // --- Constants (exp4j built-ins) ---
  {
    label: 'pi lowercase',
    expression: 'pi',
    scope: {},
    expected: Math.PI,
    approximate: true,
  },
  {
    label: 'PI uppercase (backward compat)',
    expression: 'PI',
    scope: {},
    expected: Math.PI,
    approximate: true,
  },
  {
    label: 'e constant',
    expression: 'e',
    scope: {},
    expected: Math.E,
    approximate: true,
  },
  {
    label: 'E uppercase (backward compat)',
    expression: 'E',
    scope: {},
    expected: Math.E,
    approximate: true,
  },
  {
    label: 'constant in expression',
    expression: '2 * pi * r',
    scope: { r: 1 },
    expected: 2 * Math.PI,
    approximate: true,
  },

  // --- Trigonometric functions ---
  {
    label: 'sin(0) = 0',
    expression: 'sin(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'cos(0) = 1',
    expression: 'cos(0)',
    scope: {},
    expected: 1,
  },
  {
    label: 'tan(0) = 0',
    expression: 'tan(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'sin(pi/2) = 1',
    expression: 'sin(pi / 2)',
    scope: {},
    expected: 1,
    approximate: true,
  },
  {
    label: 'cos(pi) = -1',
    expression: 'cos(pi)',
    scope: {},
    expected: -1,
    approximate: true,
  },
  {
    label: 'asin(1) = pi/2',
    expression: 'asin(1)',
    scope: {},
    expected: Math.PI / 2,
    approximate: true,
  },
  {
    label: 'acos(1) = 0',
    expression: 'acos(1)',
    scope: {},
    expected: 0,
  },
  {
    label: 'atan(0) = 0',
    expression: 'atan(0)',
    scope: {},
    expected: 0,
  },

  // --- Hyperbolic functions ---
  {
    label: 'sinh(0) = 0',
    expression: 'sinh(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'cosh(0) = 1',
    expression: 'cosh(0)',
    scope: {},
    expected: 1,
  },
  {
    label: 'tanh(0) = 0',
    expression: 'tanh(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'sinh(1)',
    expression: 'sinh(1)',
    scope: {},
    expected: Math.sinh(1),
    approximate: true,
  },

  // --- Logarithmic functions ---
  {
    label: 'log(e) = 1 (natural log)',
    expression: 'log(e)',
    scope: {},
    expected: 1,
    approximate: true,
  },
  {
    label: 'log(1) = 0',
    expression: 'log(1)',
    scope: {},
    expected: 0,
  },
  {
    label: 'log10(100) = 2',
    expression: 'log10(100)',
    scope: {},
    expected: 2,
    approximate: true,
  },
  {
    label: 'log10(1000) = 3',
    expression: 'log10(1000)',
    scope: {},
    expected: 3,
    approximate: true,
  },
  {
    label: 'log2(8) = 3',
    expression: 'log2(8)',
    scope: {},
    expected: 3,
    approximate: true,
  },
  {
    label: 'log2(1) = 0',
    expression: 'log2(1)',
    scope: {},
    expected: 0,
  },

  // --- Other math functions ---
  {
    label: 'abs(-42) = 42',
    expression: 'abs(-42)',
    scope: {},
    expected: 42,
  },
  {
    label: 'abs(42) = 42 (positive passthrough)',
    expression: 'abs(42)',
    scope: {},
    expected: 42,
  },
  {
    label: 'ceil(4.2) = 5',
    expression: 'ceil(4.2)',
    scope: {},
    expected: 5,
  },
  {
    label: 'floor(4.9) = 4',
    expression: 'floor(4.9)',
    scope: {},
    expected: 4,
  },
  {
    label: 'round(4.5) = 5',
    expression: 'round(4.5)',
    scope: {},
    expected: 5,
  },
  {
    label: 'cbrt(27) = 3',
    expression: 'cbrt(27)',
    scope: {},
    expected: 3,
  },
  {
    label: 'cbrt(8) = 2',
    expression: 'cbrt(8)',
    scope: {},
    expected: 2,
  },
  {
    label: 'sqrt(144) = 12',
    expression: 'sqrt(144)',
    scope: {},
    expected: 12,
  },
  {
    label: 'exp(0) = 1',
    expression: 'exp(0)',
    scope: {},
    expected: 1,
  },
  {
    label: 'exp(1) = e',
    expression: 'exp(1)',
    scope: {},
    expected: Math.E,
    approximate: true,
  },
  {
    label: 'signum(-100) = -1',
    expression: 'signum(-100)',
    scope: {},
    expected: -1,
  },
  {
    label: 'signum(0) = 0',
    expression: 'signum(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'signum(100) = 1',
    expression: 'signum(100)',
    scope: {},
    expected: 1,
  },
  {
    label: 'pow(2, 8) = 256',
    expression: 'pow(2, 8)',
    scope: {},
    expected: 256,
  },
  {
    label: 'min(3, 7) = 3',
    expression: 'min(3, 7)',
    scope: {},
    expected: 3,
  },
  {
    label: 'max(3, 7) = 7',
    expression: 'max(3, 7)',
    scope: {},
    expected: 7,
  },

  // --- Exponentiation edge cases ---
  {
    label: '^ right-associative: 2^3^2 = 2^9 = 512',
    expression: '2^3^2',
    scope: {},
    expected: 512,
  },
  {
    label: '0^0 = 1 (Math.pow convention)',
    expression: '0^0',
    scope: {},
    expected: 1,
  },
  {
    label: 'fractional exponent: 4^0.5 = 2',
    expression: '4^0.5',
    scope: {},
    expected: 2,
  },
  {
    label: 'explicit parens with unary minus: -(1^2) = -1',
    expression: '-(1^2)',
    scope: {},
    expected: -1,
  },

  // --- Compound / real-world formulas ---
  {
    label: 'circle area: pi * r^2',
    expression: 'pi * r^2',
    scope: { r: 5 },
    expected: Math.PI * 25,
    approximate: true,
  },
  {
    label: 'Pythagorean: sqrt(a^2 + b^2)',
    expression: 'sqrt(a^2 + b^2)',
    scope: { a: 3, b: 4 },
    expected: 5,
  },
  {
    label: 'quadratic: (-b + sqrt(b^2 - 4*a*c)) / (2*a)',
    expression: '(-b + sqrt(b^2 - 4*a*c)) / (2*a)',
    scope: { a: 1, b: -5, c: 6 },
    expected: 3,
    approximate: true,
  },
  {
    label: 'compound interest: P * (1 + r)^n',
    expression: 'P * (1 + r)^n',
    scope: { P: 1000, r: 0.05, n: 10 },
    expected: 1000 * Math.pow(1.05, 10),
    approximate: true,
  },
  {
    label: 'BMI: weight / (height^2)',
    expression: 'weight / (height^2)',
    scope: { weight: 70, height: 1.75 },
    expected: 70 / Math.pow(1.75, 2),
    approximate: true,
  },
  {
    label: 'distance: sqrt((x2 - x1)^2 + (y2 - y1)^2)',
    expression: 'sqrt((x2 - x1)^2 + (y2 - y1)^2)',
    scope: { x1: 1, y1: 2, x2: 4, y2: 6 },
    expected: 5,
  },
  {
    label: 'chained functions: ceil(sqrt(abs(x)))',
    expression: 'ceil(sqrt(abs(x)))',
    scope: { x: -15 },
    expected: 4,
  },
  {
    label: 'mixed operators: 3 * sin(y) + x^2',
    expression: '3 * sin(y) + x^2',
    scope: { x: 2, y: 0 },
    expected: 4,
  },
  {
    label: 'volume of sphere: (4/3) * pi * r^3',
    expression: '(4/3) * pi * r^3',
    scope: { r: 3 },
    expected: (4 / 3) * Math.PI * 27,
    approximate: true,
  },
  {
    label: 'Fahrenheit to Celsius: (f - 32) * 5 / 9',
    expression: '(f - 32) * 5 / 9',
    scope: { f: 212 },
    expected: 100,
  },

  // --- Modulo edge cases ---
  {
    label: 'modulo with negative dividend',
    expression: '-10 % 3',
    scope: {},
    expected: -1,
  },
  {
    label: 'modulo with negative divisor',
    expression: '10 % -3',
    scope: {},
    expected: 1,
  },
  {
    label: 'modulo zero dividend',
    expression: '0 % 5',
    scope: {},
    expected: 0,
  },
  {
    label: 'modulo with floats',
    expression: '5.5 % 2',
    scope: {},
    expected: 1.5,
    approximate: true,
  },

  // --- Exponentiation edge cases ---
  {
    label: 'negative exponent',
    expression: '2^-1',
    scope: {},
    expected: 0.5,
  },
  {
    label: 'negative base odd exponent via variable',
    expression: 'x^3',
    scope: { x: -2 },
    expected: -8,
  },

  // --- Division edge cases ---
  {
    label: 'negative division',
    expression: '-10 / 3',
    scope: {},
    expected: -10 / 3,
    approximate: true,
  },

  // --- Rounding edge cases ---
  {
    label: 'round down',
    expression: 'round(4.4)',
    scope: {},
    expected: 4,
  },
  {
    label: 'round up',
    expression: 'round(4.6)',
    scope: {},
    expected: 5,
  },
  {
    label: 'round negative half (JS Math.round)',
    expression: 'round(-0.5)',
    scope: {},
    expected: 0,
    approximate: true, // Math.round(-0.5) returns -0 in JS; toBeCloseTo treats -0 ≈ 0
  },

  // --- Function domain boundaries ---
  {
    label: 'sqrt of zero',
    expression: 'sqrt(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'cube root of negative',
    expression: 'cbrt(-8)',
    scope: {},
    expected: -2,
  },
  {
    label: 'cube root of zero',
    expression: 'cbrt(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'asin of zero',
    expression: 'asin(0)',
    scope: {},
    expected: 0,
  },
  {
    label: 'acos of zero',
    expression: 'acos(0)',
    scope: {},
    expected: Math.PI / 2,
    approximate: true,
  },

  // --- Unicode constants ---
  {
    label: 'unicode pi in expression',
    expression: '\u03C0 * 2',
    scope: {},
    expected: Math.PI * 2,
    approximate: true,
  },
  {
    label: 'golden ratio phi',
    expression: '\u03C6 + 1',
    scope: {},
    expected: 2.61803398874,
    approximate: true,
  },

  // --- Operator precedence ---
  {
    label: 'modulo precedence over addition',
    expression: '2 + 3 % 4',
    scope: {},
    expected: 5,
  },
  {
    label: 'subtraction left-associative',
    expression: '10 - 5 - 2',
    scope: {},
    expected: 3,
  },
]

// ---------------------------------------------------------------------------
// Error formulas — each must throw when evaluated
// ---------------------------------------------------------------------------

export interface ErrorFormula {
  /** Human-readable label for test output */
  label: string
  /** The formula string */
  expression: string
  /** Variable values to inject */
  scope: Record<string, number>
  /** Substring expected in the error message (optional) */
  errorContains?: string
  /** Category of error for documentation */
  category:
    | 'syntax'
    | 'runtime'
    | 'unsupported_operator'
    | 'undefined_variable'
    | 'domain_error'
}

export const ERROR_FORMULAS: ErrorFormula[] = [
  // --- Syntax errors (jsep can't parse) ---
  {
    label: 'double operator',
    expression: 'x +* y',
    scope: { x: 1, y: 2 },
    category: 'syntax',
  },
  {
    label: 'unclosed parenthesis',
    expression: '(x + y',
    scope: { x: 1, y: 2 },
    category: 'syntax',
  },
  {
    label: 'trailing operator',
    expression: 'x + ',
    scope: { x: 1 },
    category: 'syntax',
  },
  {
    label: 'leading operator (non-unary)',
    expression: '* x',
    scope: { x: 1 },
    category: 'syntax',
  },
  {
    label: 'empty parentheses',
    expression: '()',
    scope: {},
    category: 'syntax',
  },

  // --- Unsupported operators (removed from jsep, exp4j doesn't have them) ---
  {
    label: 'logical AND (&&)',
    expression: '1 && 1',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'logical OR (||)',
    expression: '1 || 0',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'bitwise OR (|)',
    expression: '5 | 3',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'bitwise AND (&)',
    expression: '5 & 3',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'strict equality (===)',
    expression: '1 === 1',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'strict inequality (!==)',
    expression: '1 !== 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'loose equality (==)',
    expression: '1 == 1',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'loose inequality (!=)',
    expression: '1 != 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'less than (<)',
    expression: '1 < 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'greater than (>)',
    expression: '1 > 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'less than or equal (<=)',
    expression: '1 <= 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'greater than or equal (>=)',
    expression: '1 >= 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'left shift (<<)',
    expression: '1 << 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'right shift (>>)',
    expression: '1 >> 2',
    scope: {},
    category: 'unsupported_operator',
  },
  {
    label: 'unsigned right shift (>>>)',
    expression: '1 >>> 2',
    scope: {},
    category: 'unsupported_operator',
  },

  // --- Undefined variables ---
  {
    label: 'undefined single variable',
    expression: 'x',
    scope: {},
    errorContains: 'Undefined variable: x',
    category: 'undefined_variable',
  },
  {
    label: 'one of two variables undefined',
    expression: 'x + y',
    scope: { x: 1 },
    errorContains: 'Undefined variable: y',
    category: 'undefined_variable',
  },
  {
    label: 'unknown function name',
    expression: 'foobar(5)',
    scope: {},
    errorContains: 'Unknown function',
    category: 'undefined_variable',
  },

  // --- Runtime / domain errors ---
  {
    label: 'division by zero',
    expression: '1 / 0',
    scope: {},
    errorContains: 'Division by zero',
    category: 'runtime',
  },
  {
    label: 'division by zero via variable',
    expression: 'x / y',
    scope: { x: 10, y: 0 },
    errorContains: 'Division by zero',
    category: 'runtime',
  },
  {
    label: 'sqrt of negative (NaN)',
    expression: 'sqrt(-1)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'log of zero (produces -Infinity)',
    expression: 'log(0)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'log of negative (NaN)',
    expression: 'log(-1)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'asin out of domain (>1)',
    expression: 'asin(2)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'acos out of domain (>1)',
    expression: 'acos(2)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'overflow to Infinity: exp(1000)',
    expression: 'exp(1000)',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'overflow via large exponent: 10^1000',
    expression: '10^1000',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },

  // --- Modulo / division edge cases producing non-finite results ---
  {
    label: 'modulo by zero (NaN)',
    expression: '10 % 0',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
  {
    label: 'zero divided by zero (NaN)',
    expression: '0 / 0',
    scope: {},
    errorContains: 'Division by zero',
    category: 'runtime',
  },
  {
    label: 'exponentiation overflow to Infinity',
    expression: '2^10000',
    scope: {},
    errorContains: 'Formula did not produce a finite number',
    category: 'domain_error',
  },
]
