'use client'

import { useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { Badge, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  builtinNames,
  parseExpression,
  variablesOf,
} from '@/lib/formula-expression'
import { useConstants } from '@/hooks/api/leaves'
import { MAX_LIST_PAGE_SIZE } from '@/constants'

/**
 * The expression input, plus everything the writer needs to know while typing.
 *
 * Validity, the variable list and the offered names all come from `lib/formula-expression`, which is
 * the SAME parser the server uses — so "valid" here means the create will not 422, and the variables
 * shown are exactly the `variables[]` the server will derive. Before that module existed the writer
 * discovered both only after saving.
 */
export function FormulaExpressionField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  // Caret at the last blur/selection, so a chip inserts where the user was rather than at the end.
  const caret = useRef<{ start: number; end: number } | null>(null)

  const { data: constantsPage } = useConstants().useList({
    page: 1,
    size: MAX_LIST_PAGE_SIZE,
  })
  const constantNames = useMemo(
    () => (constantsPage?.data ?? []).map((c) => c.name),
    [constantsPage]
  )

  const parsed = useMemo(() => {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      parseExpression(trimmed)
      return { variables: variablesOf(trimmed), error: null }
    } catch (e) {
      return { variables: [], error: (e as Error).message }
    }
  }, [value])

  const { functions, constants: builtinConstants } = useMemo(
    () => builtinNames(),
    []
  )

  const rememberCaret = () => {
    const el = inputRef.current
    if (!el) return
    caret.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    }
  }

  /** Splice `text` in at the remembered caret, then put the caret after it. */
  const insert = (text: string) => {
    const el = inputRef.current
    const at = caret.current ?? { start: value.length, end: value.length }
    const next = value.slice(0, at.start) + text + value.slice(at.end)
    onChange(next)

    const cursor = at.start + text.length
    caret.current = { start: cursor, end: cursor }
    // After React re-renders with the new value; otherwise the caret snaps to the end.
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="formula-expression">{t('formulas.expression')}</Label>
      <Input
        id="formula-expression"
        ref={inputRef}
        value={value}
        disabled={disabled}
        placeholder={t('formulas.placeholders.expression')}
        className={cn(
          'font-mono',
          parsed?.error && 'border-destructive focus-visible:ring-destructive'
        )}
        onChange={(e) => onChange(e.target.value)}
        onSelect={rememberCaret}
        onBlur={rememberCaret}
        aria-invalid={!!parsed?.error}
        aria-describedby="formula-expression-status"
      />

      <p
        id="formula-expression-status"
        className={cn(
          'flex items-center gap-1.5 text-xs',
          parsed?.error ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {parsed?.error ? (
          <>
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {parsed.error}
          </>
        ) : parsed ? (
          <>
            <CheckCircle2
              className="h-3 w-3 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            {t('formulas.validSyntax')}
          </>
        ) : (
          t('formulas.expressionHint')
        )}
      </p>

      {parsed && parsed.variables.length > 0 && (
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
          <p className="text-xs text-muted-foreground">
            {t('formulas.variablesDerived')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parsed.variables.map((variable) => {
              // A variable named after an existing constant is one the user can bind in a click.
              // Saying so here is the whole reason the constant list is fetched.
              const matches = constantNames.includes(variable)
              return (
                <Badge
                  key={variable}
                  variant={matches ? 'default' : 'secondary'}
                  className="h-5 gap-1 font-mono text-[10px]"
                  title={matches ? t('formulas.matchesConstant') : undefined}
                >
                  {variable}
                  {matches && (
                    <span className="not-italic">
                      · {t('formulas.constantShort')}
                    </span>
                  )}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {!disabled && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {t('formulas.insertHint')}
          </p>
          <div className="flex flex-wrap gap-1">
            {constantNames.map((name) => (
              <InsertChip
                key={`c-${name}`}
                label={name}
                onInsert={() => insert(name)}
              />
            ))}
            {builtinConstants.map((name) => (
              <InsertChip
                key={`k-${name}`}
                label={name}
                onInsert={() => insert(name)}
              />
            ))}
            {functions.map((name) => (
              <InsertChip
                key={`f-${name}`}
                label={`${name}()`}
                // Caret lands inside the parens, ready for the argument.
                onInsert={() => insert(`${name}(`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InsertChip({
  label,
  onInsert,
}: {
  label: string
  onInsert: () => void
}) {
  return (
    <button
      type="button"
      onClick={onInsert}
      className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  )
}
