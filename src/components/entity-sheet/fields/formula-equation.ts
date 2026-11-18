// A number literal first (hex, then decimal with an exponent), so a name is never found inside one:
// the `e` of `2.5e-3` and the `x10` of `0x10` are part of the number. A name may start with `$`,
// as the node allows (`$CO2`), and use any script (`ρ`, `débit`).
const TOKEN =
  /0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[\p{L}_$][\p{L}\p{N}_$]*|\*|\//gu
const NUMBER = /^[\d.]/
const OPERATOR: Record<string, string> = { '*': ' × ', '/': ' ÷ ' }

// Text that would change how the expression reads if written in bare: a sign (`-3 ^ 2` reads -9),
// a unit with a slash (`÷ 2 kgCO2e/kWh`), or an operator of its own.
const NEEDS_BRACKETS = /^[-+]|\/|\s[-+*×÷^]\s/

function neighbours(src: string, start: number, end: number) {
  return {
    before: src.slice(0, start).trimEnd().at(-1),
    after: src.slice(end).trimStart()[0],
  }
}

/** `sqrt(x)` and `max(a, b)`: a whole argument reads the same with or without brackets. */
function isWholeArgument(before?: string, after?: string) {
  return (before === '(' || before === ',') && (after === ')' || after === ',')
}

/** Next to `^` a unit needs brackets too: `3 m ^ 2` would square only the unit. */
function bracketed(text: string, before?: string, after?: string) {
  if (isWholeArgument(before, after)) return text
  const nextToPower = before === '^' || after === '^'
  return NEEDS_BRACKETS.test(text) || (nextToPower && /\s/.test(text))
    ? `(${text})`
    : text
}

/**
 * A formula with its inputs written in: `p * t` over `2 kW` and `5 h` reads `2 kW × 5 h`.
 *
 * A name with no text (an unbound variable, a function such as `log`) stays as written, so the
 * result is always the whole expression.
 */
export function equationText(
  expression: string,
  textFor: (variable: string) => string | undefined
): string {
  return expression
    .replace(TOKEN, (token, offset: number, src: string) => {
      if (OPERATOR[token]) return OPERATOR[token]
      if (NUMBER.test(token)) return token
      const text = textFor(token)
      if (text === undefined) return token
      const { before, after } = neighbours(src, offset, offset + token.length)
      return bracketed(text, before, after)
    })
    .replace(/\s+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')')
    .trim()
}
