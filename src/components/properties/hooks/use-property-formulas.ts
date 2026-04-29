import { useCallback, useMemo } from 'react'

import { logger } from '@/lib'
import {
  isOwnCompositeId,
  makeCompositeId,
  parseCompositeId,
} from '../utils/composite-id'
import type { FormulaData, Property } from '../types'
import type { AvailableProperty } from './use-formula-evaluation'

export type FormulaCreateTask = {
  formulaData: FormulaData
  args: Array<{ name: string; propertyValueUUID: string }>
  resultUuid: string
}

export type FormulaDeleteTask = {
  calcUuid: string
  formulaUuid?: string
}

/** Stable id for a property (uuid or temp id). */
function getPropertyId(property: Property): string {
  return property.uuid || property._tempId || ''
}

/**
 * All formula-related derivations for the property editor:
 *  - the list of "available" sibling properties usable as formula variables,
 *  - composite-ID → real value UUID resolution against the current state,
 *  - building formula calc args from a `FormulaData` mapping.
 *
 * Kept separate from `use-property-editor` so the formula plumbing can be
 * unit-tested in isolation without spinning up the full editor state.
 */
export function usePropertyFormulas(
  properties: Property[],
  allProperties: Property[]
) {
  // Identity key over what actually influences `allAvailableProperties` —
  // changing only e.g. `_isNew` should not invalidate the memo.
  const propertiesKey = JSON.stringify(
    properties.map((p) => ({
      id: getPropertyId(p),
      key: p.key,
      values: p.values?.map((v) => ({
        uuid: v.uuid,
        value: v.value,
      })),
    }))
  )

  const allAvailableProperties = useMemo((): AvailableProperty[] => {
    const result: AvailableProperty[] = []

    properties
      .filter((p) => !p._deleted && p.key)
      .forEach((p) => {
        const propId = getPropertyId(p)
        const propKey = p.key
        const propLabel = p.label || p.key

        if (p.values && p.values.length > 0) {
          p.values.forEach((v, idx) => {
            if (!v.value || v._needsInput) return
            const trimmed = v.value.trim()
            if (trimmed === '' || isNaN(Number(trimmed))) return

            result.push({
              uuid: makeCompositeId(propId, idx),
              key: propKey,
              label: propLabel,
              value: trimmed,
              valueIndex: idx,
            })
          })
        }
      })

    return result
  }, [propertiesKey])

  // Precompute the filtered "siblings" list for every property so that the
  // O(n) filter runs once per render of the editor instead of once per
  // PropertyItem child. The returned arrays are referentially stable across
  // renders unless the property/value graph changes.
  const availablePropertiesByOwner = useMemo(() => {
    const map = new Map<string, AvailableProperty[]>()
    properties
      .filter((p) => !p._deleted)
      .forEach((p) => {
        const id = getPropertyId(p)
        map.set(
          id,
          allAvailableProperties.filter(
            (entry) => !isOwnCompositeId(entry.uuid, id)
          )
        )
      })
    return map
  }, [allAvailableProperties, propertiesKey])

  const availablePropertiesFor = useCallback(
    (propertyId: string): AvailableProperty[] =>
      availablePropertiesByOwner.get(propertyId) ?? [],
    [availablePropertiesByOwner]
  )

  /**
   * Resolve a composite ID (e.g. "{propUUID}::0") to a real property value
   * UUID by scanning the current properties list. Only returns UUIDs that are
   * already known (already persisted) — for values created in the current save
   * session, callers must consult a local map first.
   */
  const resolveCompositeIdToValueUUID = useCallback(
    (compositeId: string): string | null => {
      const parsed = parseCompositeId(compositeId)
      if (!parsed) return null

      const { propertyId, valueIndex } = parsed
      const prop = allProperties.find(
        (p) => p.uuid === propertyId || p._tempId === propertyId
      )
      return prop?.values?.[valueIndex]?.uuid || null
    },
    [allProperties]
  )

  /**
   * Build formula calc args by resolving composite IDs using a caller-supplied
   * resolver. Unresolved variables are logged and skipped — the caller is
   * notified via the returned `unresolved` list so it can surface a warning.
   */
  const buildFormulaArgs = useCallback(
    (
      formulaData: FormulaData,
      resolve: (compositeId: string) => string | null
    ): {
      args: Array<{ name: string; propertyValueUUID: string }>
      unresolved: string[]
    } => {
      const args: Array<{ name: string; propertyValueUUID: string }> = []
      const unresolved: string[] = []
      for (const [name, mapping] of Object.entries(
        formulaData.variableMapping || {}
      )) {
        const realUUID = resolve(mapping.propertyUuid)
        if (realUUID) {
          args.push({ name, propertyValueUUID: realUUID })
        } else {
          unresolved.push(name)
          logger.warn(
            'Formula variable could not be resolved to a property value UUID',
            {
              varName: name,
              compositeId: mapping.propertyUuid,
              formulaUuid: formulaData.formulaUuid,
            }
          )
        }
      }
      return { args, unresolved }
    },
    []
  )

  return {
    availablePropertiesFor,
    resolveCompositeIdToValueUUID,
    buildFormulaArgs,
  }
}
