import { useState, useCallback, useMemo } from 'react'
import jsep from 'jsep'

import { extractVariables, safeEvaluate } from '../utils/formula-evaluation'

export interface FormulaVariable {
  name: string
  propertyKey: string
  propertyUuid: string
  resolvedValue: number | null
}

export interface FormulaEvaluationResult {
  isValid: boolean
  result: number | null
  resolvedExpression: string
  error: string | null
}

export interface AvailableProperty {
  uuid: string // Composite ID: "propertyId::valueIndex" for unique selection
  key: string
  label?: string
  value: string
  valueIndex?: number
}

/**
 * Hook for formula parsing, variable detection, and evaluation.
 * Uses jsep (~6KB) for safe expression parsing and a custom evaluator.
 */
export function useFormulaEvaluation(availableProperties: AvailableProperty[]) {
  const [formula, setFormula] = useState('')
  const [variableMapping, setVariableMapping] = useState<
    Record<string, { propertyKey: string; propertyUuid: string }>
  >({})

  // Detect variables from the formula expression
  const parseResult = useMemo(() => {
    if (!formula.trim()) return { variables: [] as string[], error: null }
    return extractVariables(formula)
  }, [formula])

  const detectedVariables = parseResult.variables

  // Resolve variable values from mapped properties
  const resolvedVariables = useMemo((): FormulaVariable[] => {
    return detectedVariables.map((varName) => {
      const mapping = variableMapping[varName]
      if (!mapping) {
        return {
          name: varName,
          propertyKey: '',
          propertyUuid: '',
          resolvedValue: null,
        }
      }

      // Find the property value by UUID (supports composite IDs like "propId::0")
      const prop = availableProperties.find(
        (p) => p.uuid === mapping.propertyUuid
      )

      const numValue = prop?.value ? parseFloat(prop.value) : null

      return {
        name: varName,
        propertyKey: mapping.propertyKey,
        propertyUuid: mapping.propertyUuid,
        resolvedValue: isNaN(numValue as number) ? null : numValue,
      }
    })
  }, [detectedVariables, variableMapping, availableProperties])

  // Evaluate the formula with resolved values
  const evaluation = useMemo((): FormulaEvaluationResult => {
    if (!formula.trim()) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: null,
      }
    }

    // Check for assignment rejection
    if (parseResult.error) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: parseResult.error,
      }
    }

    // Check if formula parses
    try {
      jsep(formula)
    } catch (e: any) {
      return {
        isValid: false,
        result: null,
        resolvedExpression: '',
        error: e.message || 'Invalid formula syntax',
      }
    }

    // Check if all variables are mapped and have values
    const allMapped = resolvedVariables.every((v) => v.propertyKey !== '')
    const allResolved = resolvedVariables.every((v) => v.resolvedValue !== null)

    // Build resolved expression string
    let resolvedExpression = formula
    resolvedVariables.forEach((v) => {
      if (v.resolvedValue !== null) {
        resolvedExpression = resolvedExpression.replace(
          new RegExp(`\\b${v.name}\\b`, 'g'),
          String(v.resolvedValue)
        )
      }
    })

    if (!allMapped) {
      return {
        isValid: true,
        result: null,
        resolvedExpression,
        error: null,
      }
    }

    if (!allResolved) {
      // Identify which variables have non-numeric values
      const nonNumeric = resolvedVariables
        .filter((v) => v.propertyKey && v.resolvedValue === null)
        .map((v) => `${v.name} → "${v.propertyKey}"`)
      return {
        isValid: true,
        result: null,
        resolvedExpression,
        error:
          nonNumeric.length > 0
            ? `Non-numeric values: ${nonNumeric.join(', ')}`
            : 'Some mapped properties have non-numeric values',
      }
    }

    // Evaluate with custom evaluator
    try {
      const scope: Record<string, number> = {}
      resolvedVariables.forEach((v) => {
        if (v.resolvedValue !== null) {
          scope[v.name] = v.resolvedValue
        }
      })
      const result = safeEvaluate(formula, scope)

      return {
        isValid: true,
        result: typeof result === 'number' && !isNaN(result) ? result : null,
        resolvedExpression,
        error: null,
      }
    } catch (e: any) {
      return {
        isValid: false,
        result: null,
        resolvedExpression,
        error: e.message || 'Evaluation error',
      }
    }
  }, [formula, resolvedVariables, parseResult.error])

  // Map a variable to a property value (propertyUuid may be a composite ID like "propId::0")
  const mapVariable = useCallback(
    (variableName: string, propertyKey: string, propertyUuid: string) => {
      setVariableMapping((prev) => ({
        ...prev,
        [variableName]: { propertyKey, propertyUuid },
      }))
    },
    []
  )

  // Reset all state
  const reset = useCallback(() => {
    setFormula('')
    setVariableMapping({})
  }, [])

  // Set formula and optionally pre-fill variable mapping
  const setFormulaWithMapping = useCallback(
    (
      newFormula: string,
      mapping?: Record<string, { propertyKey: string; propertyUuid: string }>
    ) => {
      setFormula(newFormula)
      if (mapping) {
        setVariableMapping(mapping)
      }
    },
    []
  )

  return {
    formula,
    setFormula,
    setFormulaWithMapping,
    detectedVariables,
    resolvedVariables,
    variableMapping,
    mapVariable,
    evaluation,
    reset,
  }
}
