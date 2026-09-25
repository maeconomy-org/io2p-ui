const TOKEN = /[A-Za-z_][A-Za-z0-9_]*|\*|\//g
const OPERATOR: Record<string, string> = { '*': ' × ', '/': ' ÷ ' }

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
    .replace(TOKEN, (token) => OPERATOR[token] ?? textFor(token) ?? token)
    .replace(/\s+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')')
    .trim()
}
