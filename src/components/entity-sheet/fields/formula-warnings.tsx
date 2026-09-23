'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { AlertTriangle, Info } from 'lucide-react'
import type { FormulaPreviewWarning } from 'io2p-client'

import { cn } from '@/lib/utils'

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

type Format = {
  number: (n: number) => string
  list: (items: string[]) => string
}

/**
 * A preview warning in the reader's language, built from its fields. `detail` is English by
 * contract, so it is used only for a code this app does not know — the set is open.
 *
 * A literal conversion's number is the product of every scaling literal, inverted below 1 (`* 10
 * * 100` and `* 0.001` both send 1000), and the fields do not say whether it divides or multiplies
 * — so the text never claims the number is written in the formula.
 */
export function warningText(
  warning: FormulaPreviewWarning,
  t: Translate,
  format: Format
): string {
  const { code, literal, unit, vars = [], per } = warning
  const key = 'objects.formulaEditor.warning'
  switch (code) {
    case 'hand-conversion':
      if (literal === undefined || !unit) break
      return vars.length > 0
        ? t(`${key}.handConversionConstant`, {
            name: vars[0],
            literal: format.number(literal),
            unit,
          })
        : t(`${key}.handConversion`, { literal: format.number(literal), unit })
    case 'factor':
      if (vars.length === 0 || !unit) break
      return t(per ? `${key}.factor` : `${key}.factorNoPer`, {
        vars: format.list(vars),
        count: vars.length,
        unit,
        // The node's count unit is the symbol `pcs`, which reads badly after "per".
        ...(per && { per: per === 'pcs' ? t(`${key}.perItem`) : per }),
      })
    case 'declare-unit':
      return unit
        ? t(`${key}.declareUnitSuggested`, { unit })
        : t(`${key}.declareUnit`)
  }
  return warning.detail
}

/** A factor reading asks the author to check a value; the other codes say the result is off. */
const isAdvice = (warning: FormulaPreviewWarning) => warning.code === 'factor'

export function FormulaWarnings({
  warnings,
}: {
  warnings: readonly FormulaPreviewWarning[]
}) {
  const t = useTranslations()
  const format = useFormatter()
  if (warnings.length === 0) return null
  // A conversion constant can be 0.000001, which the default three decimals print as 0.
  const text: Format = {
    number: (n) => format.number(n, { maximumSignificantDigits: 12 }),
    list: (items) => format.list(items, { type: 'conjunction' }),
  }
  return (
    <ul className="space-y-1" data-testid="formula-warnings">
      {warnings.map((warning, i) => {
        const advice = isAdvice(warning)
        const Icon = advice ? Info : AlertTriangle
        return (
          <li
            key={`${warning.code}-${i}`}
            data-testid={`formula-warning-${warning.code}`}
            className={cn(
              'flex items-start gap-1.5 text-xs',
              advice
                ? 'text-muted-foreground'
                : 'text-amber-600 dark:text-amber-500'
            )}
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{warningText(warning, t, text)}</span>
          </li>
        )
      })}
    </ul>
  )
}
