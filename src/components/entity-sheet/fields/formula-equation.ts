// A number literal first (hex, then decimal with an exponent), so a name is never found inside one:
// the `e` of `2.5e-3` and the `x10` of `0x10` are part of the number. A name may start with `$`,
// as the node allows (`$CO2`).
const TOKEN =
  /0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*|\*|\//g
const NUMBER = /^[\d.]/
const OPERATOR: Record<string, string> = { '*': ' × ', '/': ' ÷ ' }

// Text that would change how the expression reads if written in bare: a sign (`-3 ^ 2` reads -9),
// a unit with a slash (`÷ 2 kgCO2e/kWh`), or an operator of its own.
const NEEDS_BRACKETS = /^[-+]|\/|\s[-+*×÷^]\s/

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
    .replace(TOKEN, (token) => {
      if (OPERATOR[token]) return OPERATOR[token]
      if (NUMBER.test(token)) return token
      const text = textFor(token)
      if (text === undefined) return token
      return NEEDS_BRACKETS.test(text) ? `(${text})` : text
    })
    .replace(/\s+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')')
    .trim()
}
