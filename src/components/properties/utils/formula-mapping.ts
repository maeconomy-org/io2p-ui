import type {
  AggregateUUMathFormulaCreateDTO,
  AggregateUUMathFormula,
  AggregateEntity,
  UUMathFormulaCalcArg,
} from 'iom-sdk'

import {
  makeCompositeId,
  makeIndexCompositeId,
  parseCompositeId,
} from './composite-id'

/**
 * Generate a temporary UUID for property values during object creation.
 * Uses crypto.randomUUID() which produces valid UUID v4 format.
 */
export function generateTempUUID(): string {
  return crypto.randomUUID()
}

/**
 * Assigns temp UUIDs to all property values and returns a lookup map.
 * @param properties - Array of properties from the form
 * @returns Map from composite ID (prop-{i}::{vIdx}) to temp UUID
 */
export function buildTempUUIDMap(properties: any[]): Map<string, string> {
  const map = new Map<string, string>()
  properties?.forEach((prop: any, propIndex: number) => {
    prop.values?.forEach((_val: any, valIndex: number) => {
      map.set(makeIndexCompositeId(propIndex, valIndex), generateTempUUID())
    })
  })
  return map
}

/**
 * Converts client-side formulaData to the aggregate API math formula create payload.
 *
 * @param formulaData - Client-side formula data from the property value
 * @param tempUUIDMap - Map from composite IDs to temp UUIDs
 * @param propIndex - Index of the property containing this formula value
 * @param valIndex - Index of the value within the property
 * @returns AggregateUUMathFormulaCreateDTO or null if no formula selected
 */
export function mapFormulaToAggregatePayload(
  formulaData: any,
  tempUUIDMap: Map<string, string>,
  propIndex: number,
  valIndex: number
): AggregateUUMathFormulaCreateDTO | null {
  if (!formulaData?.formulaUuid) return null

  // Build args from variable mapping
  const args: UUMathFormulaCalcArg[] = []
  const variableMapping = formulaData.variableMapping || {}

  for (const [varName, mapping] of Object.entries(variableMapping)) {
    const mappingData = mapping as {
      propertyKey: string
      propertyUuid: string
    }
    // propertyUuid is composite ID like "prop-0::1" — resolve to temp UUID
    const tempUUID = tempUUIDMap.get(mappingData.propertyUuid)
    if (tempUUID) {
      args.push({
        name: varName,
        propertyValueUUID: tempUUID,
      })
    }
  }

  // Result references the current value's temp UUID
  const resultCompositeId = makeIndexCompositeId(propIndex, valIndex)
  const resultTempUUID = tempUUIDMap.get(resultCompositeId)

  if (!resultTempUUID || args.length === 0) return null

  return {
    uuid: formulaData.formulaUuid,
    mathFormulaCalc: {
      args,
      result: {
        propertyValueUUID: resultTempUUID,
      },
    },
  }
}

/**
 * Converts an aggregate response math formula back to client-side formulaData.
 *
 * @param mathFormula - Math formula from aggregate response
 * @param entity - Full aggregate entity (to resolve property value UUIDs back to keys)
 * @returns Client-side formulaData object, or null if cannot be resolved
 */
export function mapAggregateResponseToFormulaData(
  mathFormula: AggregateUUMathFormula,
  entity: AggregateEntity
): any | null {
  if (!mathFormula.mathFormulaCalc) return null

  const calc = mathFormula.mathFormulaCalc
  const variableMapping: Record<
    string,
    { propertyKey: string; propertyUuid: string }
  > = {}

  // Reverse-map args: find which property value each arg points to
  // Use editCompositeId ({propUUID}::{vIdx}) so it matches the Select
  // options built by PropertySectionEditor's availableProperties
  for (const arg of calc.args || []) {
    const resolved = resolvePropertyValueUUID(arg.propertyValueUUID, entity)
    if (resolved) {
      variableMapping[arg.name] = {
        propertyKey: resolved.propertyKey,
        propertyUuid: resolved.editCompositeId,
      }
    }
  }

  return {
    formula: mathFormula.expression || '',
    formulaUuid: mathFormula.uuid,
    formulaName: mathFormula.name,
    variableMapping,
    result: null, // Will be evaluated client-side
    resolvedExpression: '',
    isValid: false,
  }
}

/**
 * Resolves a property value UUID back to a composite ID and property key
 * by scanning the entity's properties.
 *
 * Returns two composite ID formats:
 * - `compositeId`: index-based `prop-{pIdx}::{vIdx}` used during creation
 * - `editCompositeId`: UUID-based `{propUUID}::{vIdx}` used during editing
 *   (matches `availableProperties` format in PropertySectionEditor)
 */
function resolvePropertyValueUUID(
  propertyValueUUID: string,
  entity: AggregateEntity
): {
  propertyKey: string
  compositeId: string
  editCompositeId: string
} | null {
  const properties = entity.properties || []
  for (let pIdx = 0; pIdx < properties.length; pIdx++) {
    const prop = properties[pIdx]
    const values = prop.values || []
    for (let vIdx = 0; vIdx < values.length; vIdx++) {
      if (values[vIdx].uuid === propertyValueUUID) {
        return {
          propertyKey: prop.key || '',
          compositeId: makeIndexCompositeId(pIdx, vIdx),
          editCompositeId: makeCompositeId(prop.uuid || `prop-${pIdx}`, vIdx),
        }
      }
    }
  }
  return null
}

/**
 * For the edit flow: maps formulaData to a standalone UUMathFormulaCalcDTO
 * using real (existing) property value UUIDs.
 *
 * @param formulaData - Client-side formula data
 * @param entity - The aggregate entity with real property value UUIDs
 * @returns Object with args and result using real UUIDs, or null
 */
export function mapFormulaToStandaloneCalc(
  formulaData: any,
  entity: AggregateEntity,
  resultPropertyValueUUID: string
): {
  args: UUMathFormulaCalcArg[]
  result: { propertyValueUUID: string }
} | null {
  if (!formulaData?.formulaUuid) return null

  const args: UUMathFormulaCalcArg[] = []
  const variableMapping = formulaData.variableMapping || {}
  const properties = entity.properties || []

  for (const [varName, mapping] of Object.entries(variableMapping)) {
    const mappingData = mapping as {
      propertyKey: string
      propertyUuid: string
    }
    // Resolve composite ID to real property value UUID
    // Supports both index-based (prop-{i}::{vIdx}) and UUID-based ({propUUID}::{vIdx})
    const parsed = parseCompositeId(mappingData.propertyUuid)
    if (!parsed) continue

    const { propertyId, valueIndex } = parsed
    const indexMatch = propertyId.match(/^prop-(\d+)$/)

    let realUUID: string | undefined
    if (indexMatch) {
      // Index-based: prop-{i}
      const pIdx = parseInt(indexMatch[1], 10)
      realUUID = properties[pIdx]?.values?.[valueIndex]?.uuid
    } else {
      // UUID-based: {propUUID}
      const prop = properties.find((p: any) => p.uuid === propertyId)
      realUUID = prop?.values?.[valueIndex]?.uuid
    }

    if (realUUID) {
      args.push({ name: varName, propertyValueUUID: realUUID })
    }
  }

  if (args.length === 0 || !resultPropertyValueUUID) return null

  return {
    args,
    result: { propertyValueUUID: resultPropertyValueUUID },
  }
}
