'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { CalcInput } from 'io2p-client'

import { Label } from '@/components/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { cn } from '@/lib'
import { useFormulas } from '@/hooks/api/leaves'
import { safeEvaluate } from '@/components/properties/utils/formula-evaluation'

/** A numeric sibling value a formula variable can bind to. `key` = existing id ?? new ref. */
export interface FormulaSibling {
  key: string
  label: string
  num: number
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
      <SelectTrigger className={cn('h-10', className)}>
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

  const bindingFor = (variable: string) =>
    calc.args.find((a) => a.var === variable)?.ref ?? ''

  const bindVariable = (variable: string, siblingKey: string) => {
    const others = calc.args.filter((a) => a.var !== variable)
    onChange({
      ...calc,
      args: siblingKey
        ? [...others, { var: variable, ref: siblingKey }]
        : others,
    })
  }

  const preview = useMemo(() => {
    if (!formula) return null
    const scope: Record<string, number> = {}
    for (const v of formula.variables) {
      const ref = calc.args.find((a) => a.var === v)?.ref
      const num = siblings.find((s) => s.key === ref)?.num
      if (num === undefined) return null // not all bound yet
      scope[v] = num
    }
    try {
      return { result: safeEvaluate(formula.expression, scope), error: null }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [formula, calc.args, siblings])

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
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={t('objects.formulaEditor.selectValue')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {siblings.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t('objects.formulaEditor.noNumericValues')}
                    </div>
                  )}
                  {siblings.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      <span className="ml-1 text-muted-foreground">
                        ({s.num})
                      </span>
                    </SelectItem>
                  ))}
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
