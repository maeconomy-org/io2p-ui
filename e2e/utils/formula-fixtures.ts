/**
 * E2E formula test fixtures — curated subset for browser-level testing.
 *
 * These are intentionally separate from the unit test fixtures
 * (src/__tests__/components/properties/formula-fixtures.ts) because:
 * - E2E tests need fewer formulas (UI interaction is slow)
 * - Different data shape (properties to create, UI assertions)
 * - Different import paths (e2e/ vs src/@/ aliases)
 */

// ---------------------------------------------------------------------------
// Syntax validation — for /templates formula sheet (green/red border checks)
// ---------------------------------------------------------------------------

export interface SyntaxFixture {
  label: string
  expression: string
}

/** Expressions that should show green border (valid jsep syntax + exp4j operators) */
export const E2E_SYNTAX_VALID: SyntaxFixture[] = [
  { label: 'basic arithmetic with precedence', expression: '2 + 3 * 4' },
  { label: '^ as exponentiation (exp4j)', expression: '2^10' },
  { label: '^ right-associative', expression: '2^3^2' },
  { label: 'function call', expression: 'sqrt(144)' },
  { label: 'trig + lowercase pi constant', expression: 'sin(pi / 2)' },
  { label: 'natural log + e constant', expression: 'log(e)' },
  { label: 'new exp4j function (signum)', expression: 'signum(-5)' },
  { label: 'nested function chain', expression: 'ceil(sqrt(abs(-15)))' },
]

/** Expressions that should show red border (rejected operators or syntax errors) */
export const E2E_SYNTAX_INVALID: SyntaxFixture[] = [
  { label: 'rejected logical AND', expression: '1 && 1' },
  { label: 'rejected bitwise OR', expression: '5 | 3' },
  { label: 'rejected comparison', expression: '1 < 2' },
  { label: 'rejected equality', expression: '1 == 1' },
  { label: 'syntax error (double operator)', expression: 'x +* y' },
  { label: 'syntax error (unclosed paren)', expression: '(x + y' },
]

// ---------------------------------------------------------------------------
// Evaluation — for formula editor live preview (variable mapping + result)
// ---------------------------------------------------------------------------

export interface EvalFixture {
  label: string
  expression: string
  /** Properties to create before the formula property. Each {name, value}. */
  properties: { name: string; value: string }[]
  /** Variable-to-property mapping: { variableName: propertyName } */
  variableMapping: Record<string, string>
  /** Expected result text shown in the live preview */
  expectedResult: string
}

/** Formulas to test in the Add Object formula editor with live result preview */
export const E2E_EVAL_FORMULAS: EvalFixture[] = [
  {
    label: 'simple multiplication',
    expression: 'x * 2',
    properties: [{ name: 'Width', value: '10' }],
    variableMapping: { x: 'Width' },
    expectedResult: '20',
  },
  {
    label: 'two-variable addition',
    expression: 'x + y',
    properties: [
      { name: 'A', value: '3' },
      { name: 'B', value: '4' },
    ],
    variableMapping: { x: 'A', y: 'B' },
    expectedResult: '7',
  },
  {
    label: '^ operator evaluation',
    expression: '2^x',
    properties: [{ name: 'Power', value: '10' }],
    variableMapping: { x: 'Power' },
    expectedResult: '1024',
  },
  {
    label: 'sqrt function',
    expression: 'sqrt(x)',
    properties: [{ name: 'Area', value: '144' }],
    variableMapping: { x: 'Area' },
    expectedResult: '12',
  },
]

// ---------------------------------------------------------------------------
// Round-trip — create → save → reopen → verify backend result matches
// ---------------------------------------------------------------------------

export interface RoundTripFixture {
  label: string
  expression: string
  /** Properties to create before the formula property */
  properties: { name: string; value: string }[]
  /** Variable-to-property mapping: { variableName: propertyName } */
  variableMapping: Record<string, string>
  /** Expected numeric result (shown in both frontend preview and backend detail) */
  expectedResult: string
  /** Name for the formula property */
  formulaPropertyName: string
}

/**
 * Formulas for the full round-trip test:
 * 1. Create object with numeric properties + formula property
 * 2. Verify frontend preview shows expectedResult
 * 3. Save object
 * 4. Reopen from table
 * 5. Verify backend-computed result in detail sheet matches expectedResult
 */
export const E2E_ROUND_TRIP_FORMULAS: RoundTripFixture[] = [
  {
    label: '^ operator (exponentiation end-to-end)',
    expression: 'x^2 + y',
    properties: [
      { name: 'Height', value: '5' },
      { name: 'Offset', value: '3' },
    ],
    variableMapping: { x: 'Height', y: 'Offset' },
    expectedResult: '28',
    formulaPropertyName: 'CalcPower',
  },
  {
    label: 'nested functions (Pythagorean)',
    expression: 'sqrt(pow(a, 2) + pow(b, 2))',
    properties: [
      { name: 'SideA', value: '3' },
      { name: 'SideB', value: '4' },
    ],
    variableMapping: { a: 'SideA', b: 'SideB' },
    expectedResult: '5',
    formulaPropertyName: 'Hypotenuse',
  },
  {
    label: 'real-world formula (profit margin)',
    expression: '(price - cost) / price * 100',
    properties: [
      { name: 'Price', value: '200' },
      { name: 'Cost', value: '150' },
    ],
    variableMapping: { price: 'Price', cost: 'Cost' },
    expectedResult: '25',
    formulaPropertyName: 'Margin',
  },
]
