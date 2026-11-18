import { useFormatter } from 'next-intl'

import type { EquationNumbers } from './formula-equation'

export type FormulaFormat = {
  number: (n: number) => string
  list: (items: string[]) => string
  /** No thousands groups: the `,` in `1,000` would read as an argument separator. */
  equation: EquationNumbers
}

/** Numbers and lists as the formula texts write them, in the app locale. */
export function useFormulaFormat(): FormulaFormat {
  const format = useFormatter()
  // A conversion constant can be 0.000001, which the default three decimals print as 0.
  const digits = (useGrouping: boolean) => (n: number) =>
    format.number(n, { maximumSignificantDigits: 12, useGrouping })
  const ungrouped = digits(false)
  return {
    number: digits(true),
    list: (items) => format.list(items, { type: 'conjunction' }),
    equation: {
      number: ungrouped,
      // Read from the same formatter, so the mark cannot disagree with the numbers it writes.
      decimal: ungrouped(1.5).includes(',') ? ',' : '.',
    },
  }
}
