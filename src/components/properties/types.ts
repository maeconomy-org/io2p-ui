import type { FileData } from '@/types'

/**
 * Formula data attached to a property value.
 * Tracks the formula expression, selected formula definition,
 * variable-to-property mappings, and evaluation state.
 */
export interface FormulaData {
  formula: string
  formulaUuid?: string
  formulaName?: string
  variableMapping?: Record<
    string,
    { propertyKey: string; propertyUuid: string }
  >
  result: number | null
  resolvedExpression?: string
  isValid?: boolean
  /** UUID of the formula calculation instance (set after creation, used for deletion) */
  calcUuid?: string
}

/**
 * A single value within a property.
 */
export interface PropertyValue {
  uuid?: string
  value: string
  valueTypeCast?: string
  sourceType?: string
  formulaData?: FormulaData
  files?: FileData[]
  /** Internal flag: placeholder value awaiting user input */
  _needsInput?: boolean
}

/**
 * A property on an object, containing one or more values.
 */
export interface Property {
  uuid?: string
  key: string
  label?: string
  type?: string
  values: PropertyValue[]
  files?: FileData[]
  /** Internal flag: property created in this editing session */
  _isNew?: boolean
  /** Internal flag: property marked for deletion */
  _deleted?: boolean
  /** Internal flag: property has been modified */
  _modified?: boolean
  /** Temporary ID used for tracking new properties before UUID is assigned */
  _tempId?: string
}
