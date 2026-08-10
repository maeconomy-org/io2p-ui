'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { CalcArgInput, CalcInput } from 'io2p-client'

import { Label } from '@/components/ui'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useConstants, useFormulas } from '@/hooks/api/leaves'
import { evaluateExpression } from '@/lib/formula-expression'
import { MAX_LIST_PAGE_SIZE } from '@/constants'

/**
 * A sibling value a formula variable can bind to. `key` = existing id ?? client ref.
 *
 * `num` is OPTIONAL because a bindable value is not always filled in yet — a template preset arrives
 * blank but already bound. Such a sibling can be selected and displayed; it just can't contribute to
 * the live preview until it holds a number.
 */
export interface FormulaSibling {
  key: string
  label: string
  num?: number
}

// The formula chooser — sits inline in the value row (replaces the text input in formula mode).
export function FormulaSelect({
  formulaId,
  onSelect,
  className,
}: {
  formulaId?: string
  onSelect: (formulaId: string) => void
  className?: string
}) {
  const t = useTranslations()
  const { data } = useFormulas().useList({ page: 1, size: 100 })
  const formulas = data?.data ?? []

  return (
    <Select value={formulaId ?? ''} onValueChange={onSelect}>
      <SelectTrigger className={cn('h-8', className)}>
        <SelectValue placeholder={t('objects.formulaEditor.selectFormula')} />
      </SelectTrigger>
      <SelectContent>
        {formulas.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {f.expression}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * One control, two kinds of binding.
 *
 * A calc arg binds a variable to a sibling value (`ref`) XOR a constant (`constant`, by NAME) —
 * never both, never neither. So the picker prefixes each option with its kind instead of putting a
 * mode switch beside it: choosing is one gesture, and the exclusivity is structural rather than
 * something the UI has to remember to enforce.
 *
 * A name may contain `:`, so only the FIRST separator is a delimiter.
 */
export function choiceOf(arg?: CalcArgInput): string {
  if (arg?.constant) return `constant:${arg.constant}`
  if (arg?.ref) return `sibling:${arg.ref}`
  return ''
}

export function argFromChoice(
  variable: string,
  choice: string
): CalcArgInput | null {
  if (!choice) return null
  const separator = choice.indexOf(':')
  if (separator === -1) return null

  const kind = choice.slice(0, separator)
  const value = choice.slice(separator + 1)
  if (!value) return null

  return kind === 'constant'
    ? { var: variable, constant: value }
    : { var: variable, ref: value }
}

// Variable binding + live preview for the chosen formula. Rendered below the value row.
export function FormulaBindings({
  calc,
  siblings,
  onChange,
}: {
  calc: CalcInput
  siblings: FormulaSibling[]
  onChange: (calc: CalcInput) => void
}) {
  const t = useTranslations()
  const { data: formula } = useFormulas().useGet(calc.formulaId)
  const { data: constantsPage } = useConstants().useList({
    page: 1,
    size: MAX_LIST_PAGE_SIZE,
  })
  // `?? []` inline would mint a new array each render and re-run the preview memo every time.
  const constants = useMemo(() => constantsPage?.data ?? [], [constantsPage])

  const bindingFor = (variable: string) =>
    choiceOf(calc.args.find((a) => a.var === variable))

  const bindVariable = (variable: string, choice: string) => {
    const others = calc.args.filter((a) => a.var !== variable)
    const arg = argFromChoice(variable, choice)
    onChange({ ...calc, args: arg ? [...others, arg] : others })
  }

  const preview = useMemo(() => {
    if (!formula) return null
    const scope: Record<string, number> = {}
    for (const v of formula.variables) {
      const arg = calc.args.find((a) => a.var === v)
      // A constant resolves to its CURRENT version here. The server pins the version at bind time,
      // so once saved this value is fixed — the preview shows what binding now would produce.
      const num = arg?.constant
        ? constants.find((c) => c.name === arg.constant)?.versions.at(-1)?.num
        : siblings.find((s) => s.key === arg?.ref)?.num
      // Unbound, or bound to a value the user hasn't filled in yet — either way there is nothing
      // honest to preview.
      if (num === undefined || !Number.isFinite(num)) return null
      scope[v] = num
    }
    try {
      // Same parser, options and rounding the server uses, so the preview is the number that will
      // be stored — not an approximation of it.
      return {
        result: evaluateExpression(formula.expression, scope),
        error: null,
      }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [formula, calc.args, siblings, constants])

  if (!formula) return null

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {formula.variables.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('objects.formulaEditor.noVariables')}
        </p>
      ) : (
        <>
          <Label className="text-xs text-muted-foreground">
            {t('objects.formulaEditor.bindVariables')}
          </Label>
          {formula.variables.map((variable) => (
            <div key={variable} className="flex items-center gap-2">
              <code className="w-16 shrink-0 text-sm font-medium">
                {variable}
              </code>
              <Select
                value={bindingFor(variable)}
                onValueChange={(val) => bindVariable(variable, val)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue
                    placeholder={t('objects.formulaEditor.selectValue')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {siblings.length === 0 && constants.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t('objects.formulaEditor.noNumericValues')}
                    </div>
                  )}

                  {siblings.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>
                        {t('objects.formulaEditor.siblingValues')}
                      </SelectLabel>
                      {siblings.map((s) => (
                        <SelectItem key={s.key} value={`sibling:${s.key}`}>
                          {s.label}
                          {s.num !== undefined && (
                            <span className="ml-1 text-muted-foreground">
                              ({s.num})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}

                  {/* Constants are shared, versioned numbers — a CO2 factor rather than something
                      on this entity. The server pins the version at bind time, so the value shown
                      is what this binding will freeze. */}
                  {constants.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>
                        {t('objects.formulaEditor.constants')}
                      </SelectLabel>
                      {constants.map((c) => {
                        const current = c.versions.at(-1)
                        return (
                          <SelectItem key={c.id} value={`constant:${c.name}`}>
                            {c.name}
                            {current?.data && (
                              <span className="ml-1 text-muted-foreground">
                                ({current.data})
                              </span>
                            )}
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </>
      )}

      {preview && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-sm',
            preview.error ? 'text-destructive' : 'text-emerald-600'
          )}
        >
          {preview.error ? (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>{preview.error}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t('objects.formulaEditor.result')}: {preview.result}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A bound recipe, read-only: which formula, and what each variable is bound to.
 *
 * This is what a TEMPLATE formula looks like. A template stores its recipe INERT — `source:'derived'`
 * plus `calc`, with no `num` and no `provenance`, because it computes only when the template is
 * applied to a real entity (E-2). So there is no trace to render and no result to show; without this
 * the value reads as an empty string, which looks like nothing was ever configured.
 */
export function FormulaSummary({
  calc,
  labelForValue,
}: {
  calc: CalcInput
  labelForValue?: (ref: string) => string | undefined
}) {
  const t = useTranslations()
  const { data: formula } = useFormulas().useGet(calc.formulaId)

  const bindingLabel = (variable: string): string => {
    const arg = calc.args.find((a) => a.var === variable)
    if (arg?.constant) return arg.constant
    if (arg?.ref) return labelForValue?.(arg.ref) ?? t('common.unknown')
    return t('objects.formulaEditor.unbound')
  }

  // Variables come from the formula record, so until it loads there is nothing truthful to list —
  // showing the recipe's args instead would omit any variable the user has not bound yet.
  const variables = formula?.variables ?? []

  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">
          {formula?.name ?? t('objects.propertyEditor.derived')}
        </span>
        {formula?.expression && (
          <code className="font-mono text-xs text-muted-foreground">
            {formula.expression}
          </code>
        )}
      </div>
      {variables.length > 0 && (
        <dl className="space-y-0.5">
          {variables.map((variable) => (
            <div key={variable} className="flex items-baseline gap-2 text-xs">
              <dt className="w-10 shrink-0 font-mono font-medium">
                {variable}
              </dt>
              <dd className="min-w-0 truncate text-muted-foreground">
                {bindingLabel(variable)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t('templates.formulaInert')}
      </p>
    </div>
  )
}
