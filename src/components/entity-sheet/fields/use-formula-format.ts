import { useFormatter } from 'next-intl'

import type { EquationNumbers } from './formula-equation'

export type FormulaFormat = EquationNumbers & {
  list: (items: string[]) => string
}

/** Numbers and lists as the formula texts write them, in the app locale. */
export function useFormulaFormat(): FormulaFormat {
  const format = useFormatter()
  // A conversion constant can be 0.000001, which the default three decimals print as 0.
  const number = (n: number) =>
    format.number(n, { maximumSignificantDigits: 12 })
  return {
    number,
    // Read from the same formatter, so the mark cannot disagree with the numbers it writes.
    decimal: number(1.5).includes(',') ? ',' : '.',
    list: (items) => format.list(items, { type: 'conjunction' }),
  }
}
