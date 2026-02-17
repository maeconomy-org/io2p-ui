'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from '@/components/ui'
import { FORMULA_TEMPLATES } from '@/constants'
import {
  useFormulaEvaluation,
  type AvailableProperty,
} from './hooks/use-formula-evaluation'

interface FormulaEditorProps {
  availableProperties: AvailableProperty[]
  initialFormula?: string
  initialMapping?: Record<string, { propertyKey: string; propertyUuid: string }>
  onChange?: (data: {
    formula: string
    variableMapping: Record<
      string,
      { propertyKey: string; propertyUuid: string }
    >
    result: number | null
    resolvedExpression: string
    isValid: boolean
  }) => void
  disabled?: boolean
}

export function FormulaEditor({
  availableProperties,
  initialFormula = '',
  initialMapping,
  onChange,
  disabled = false,
}: FormulaEditorProps) {
  const t = useTranslations()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const {
    formula,
    setFormula,
    setFormulaWithMapping,
    detectedVariables,
    resolvedVariables,
    variableMapping,
    mapVariable,
    evaluation,
  } = useFormulaEvaluation(availableProperties)

  // Initialize with initial values (once)
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current && initialFormula) {
      initialized.current = true
      setFormulaWithMapping(initialFormula, initialMapping)
    }
  }, [initialFormula, initialMapping, setFormulaWithMapping])

  // Notify parent of changes — use ref to avoid re-render loop
  const prevDataRef = useRef('')
  useEffect(() => {
    const dataKey = JSON.stringify({
      formula,
      variableMapping,
      result: evaluation.result,
      isValid: evaluation.isValid,
    })
    if (dataKey !== prevDataRef.current) {
      prevDataRef.current = dataKey
      onChangeRef.current?.({
        formula,
        variableMapping,
        result: evaluation.result,
        resolvedExpression: evaluation.resolvedExpression,
        isValid: evaluation.isValid,
      })
    }
  }, [formula, variableMapping, evaluation])

  const handleTemplateSelect = useCallback(
    (templateFormula: string) => {
      setFormula(templateFormula)
    },
    [setFormula]
  )

  return (
    <div className="space-y-3">
      {/* Formula Input + Template Dropdown */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder={t('objects.properties.formulaPlaceholder')}
            disabled={disabled}
            className={cn(
              'font-mono text-sm flex-1',
              evaluation.error && formula.trim()
                ? 'border-destructive focus-visible:ring-destructive'
                : evaluation.isValid && formula.trim()
                  ? 'border-green-500 focus-visible:ring-green-500'
                  : ''
            )}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1 shrink-0"
                disabled={disabled}
              >
                {t('objects.properties.formulaTemplates')}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 max-h-72 overflow-y-auto"
            >
              {(
                [
                  'basic',
                  'statistics',
                  'geometry',
                  'conversion',
                  'finance',
                ] as const
              ).map((cat, catIdx) => {
                const items = FORMULA_TEMPLATES.filter(
                  (t) => t.category === cat
                )
                if (items.length === 0) return null
                return (
                  <div key={cat}>
                    {catIdx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {cat}
                    </DropdownMenuLabel>
                    {items.map((tmpl) => (
                      <DropdownMenuItem
                        key={tmpl.label}
                        onClick={() => handleTemplateSelect(tmpl.formula)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="font-medium text-sm">
                          {tmpl.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {tmpl.formula}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {evaluation.error && formula.trim() && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {evaluation.error}
          </p>
        )}
      </div>

      {/* Variable Mapping */}
      {detectedVariables.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('objects.properties.formulaVariables')}
            </Label>
            <div className="space-y-1.5">
              {detectedVariables.map((varName) => {
                const resolved = resolvedVariables.find(
                  (v) => v.name === varName
                )
                const currentMapping = variableMapping[varName]

                return (
                  <div
                    key={varName}
                    className="flex items-center gap-2 p-1.5 rounded-md border bg-muted/30"
                  >
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs min-w-[2rem] justify-center"
                    >
                      {varName}
                    </Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Select
                      value={currentMapping?.propertyUuid || ''}
                      onValueChange={(uuid) => {
                        const prop = availableProperties.find(
                          (p) => p.uuid === uuid
                        )
                        if (prop) {
                          mapVariable(varName, prop.key, prop.uuid)
                        }
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="flex-1 h-7 text-xs">
                        <SelectValue
                          placeholder={t(
                            'objects.properties.formulaSelectProperty'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProperties.length > 0 ? (
                          availableProperties.map((prop) => (
                            <SelectItem
                              key={prop.uuid}
                              value={prop.uuid}
                              className="text-xs"
                            >
                              <span className="font-medium">
                                {prop.label || prop.key}
                              </span>
                              <span className="mx-1 text-muted-foreground">
                                –
                              </span>
                              <span className="text-muted-foreground">
                                {prop.value || '(empty)'}
                              </span>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {t('objects.properties.formulaNoProperties')}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {resolved?.resolvedValue !== null &&
                      resolved?.resolvedValue !== undefined && (
                        <Badge variant="outline" className="text-xs font-mono">
                          = {resolved.resolvedValue}
                        </Badge>
                      )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Live Preview */}
      {formula.trim() && evaluation.isValid && (
        <>
          <Separator />
          <div className="rounded-md border bg-muted/20 p-2.5 space-y-1">
            {evaluation.resolvedExpression && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {t('objects.properties.formulaResolved')}:
                </span>
                <code className="font-mono text-foreground">
                  {evaluation.resolvedExpression}
                </code>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('objects.properties.formulaResult')}:
              </span>
              {evaluation.result !== null ? (
                <span className="text-base font-bold text-primary flex items-center gap-1">
                  {Number.isInteger(evaluation.result)
                    ? evaluation.result
                    : evaluation.result.toFixed(4)}
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {t('objects.properties.formulaMapAllVariables')}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
