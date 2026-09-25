'use client'

import { useId, useState } from 'react'
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
 * * 100` and `* 0.001` both send 1000), so the text never claims the number is written in the
 * formula. `scales` is the net effect, not the operator (`* 0.001` has no division to remove); a
 * node that predates it gets the sentence naming both directions.
 */
export function warningText(
  warning: FormulaPreviewWarning,
  t: Translate,
  format: Format
): string {
  const { code, literal, scales, unit, vars = [], per } = warning
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
        : t(
            scales === 'down'
              ? `${key}.handConversionDown`
              : scales === 'up'
                ? `${key}.handConversionUp`
                : `${key}.handConversion`,
            { literal: format.number(literal), unit }
          )
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

/**
 * The one line a warning shows before "Why?". `undefined` means the full text is already one line
 * (a factor reading) or the code is unknown, so the full text is the line and there is no "Why?".
 */
export function warningShort(
  warning: FormulaPreviewWarning,
  t: Translate,
  format: Format
): string | undefined {
  const { code, literal, scales, unit, vars = [] } = warning
  const key = 'objects.formulaEditor.warning'
  switch (code) {
    case 'hand-conversion':
      if (literal === undefined || !unit) return undefined
      return vars.length > 0
        ? t(`${key}.handConversionConstantShort`, {
            name: vars[0],
            literal: format.number(literal),
            unit,
          })
        : t(
            scales === 'down'
              ? `${key}.handConversionDownShort`
              : scales === 'up'
                ? `${key}.handConversionUpShort`
                : `${key}.handConversionShort`,
            { literal: format.number(literal), unit }
          )
    case 'declare-unit':
      return unit
        ? t(`${key}.declareUnitSuggestedShort`, { unit })
        : t(`${key}.declareUnitShort`)
  }
  return undefined
}

/**
 * How loud a line is. Grey is information: the value is stored and counted (a factor reading, a
 * result counted without a unit). Amber says a number leaves a total or is probably wrong.
 */
export type MessageTone = 'info' | 'warn'

const toneOf = (warning: FormulaPreviewWarning): MessageTone =>
  warning.code === 'factor' || warning.code === 'declare-unit' ? 'info' : 'warn'

/** One line, with the longer reason behind "Why?" when there is one. */
export function FormulaMessage({
  tone,
  text,
  why,
  'data-testid': testId,
}: {
  tone: MessageTone | 'error'
  text: string
  why?: string
  'data-testid'?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const whyId = useId()
  const Icon = tone === 'info' ? Info : AlertTriangle
  return (
    <li
      data-testid={testId}
      data-tone={tone}
      className={cn(
        'text-xs',
        tone === 'info' && 'text-muted-foreground',
        tone === 'warn' && 'text-amber-700 dark:text-amber-400',
        tone === 'error' && 'text-destructive'
      )}
    >
      <span className="flex items-start gap-1.5">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {text}
          {why && (
            <>
              {' '}
              <button
                type="button"
                aria-expanded={open}
                aria-controls={whyId}
                onClick={() => setOpen((v) => !v)}
                className="text-primary underline underline-offset-2"
              >
                {t('objects.formulaEditor.why')}
              </button>
            </>
          )}
        </span>
      </span>
      {why && open && (
        <p id={whyId} className="mt-1 pl-5 text-muted-foreground">
          {why}
        </p>
      )}
    </li>
  )
}

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
        const full = warningText(warning, t, text)
        const short = warningShort(warning, t, text)
        return (
          <FormulaMessage
            key={`${warning.code}-${i}`}
            data-testid={`formula-warning-${warning.code}`}
            tone={toneOf(warning)}
            text={short ?? full}
            why={short ? full : undefined}
          />
        )
      })}
    </ul>
  )
}
