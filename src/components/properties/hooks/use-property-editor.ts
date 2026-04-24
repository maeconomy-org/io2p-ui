import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { logger, isForbiddenError } from '@/lib'
import { usePropertyManagement } from './use-property-management'
import {
  hasPropertyChanged,
  getChangedProperties,
} from '../utils/change-detection'
import {
  makeCompositeId,
  isOwnCompositeId,
  parseCompositeId,
} from '../utils/composite-id'
import type { Property, FormulaData } from '../types'
import type { AvailableProperty } from './use-formula-evaluation'

type FormulaCreateTask = {
  formulaData: FormulaData
  args: Array<{ name: string; propertyValueUUID: string }>
  resultUuid: string
}

type FormulaDeleteTask = { calcUuid: string; formulaUuid?: string }

/** Get the stable ID for a property (uuid or temp ID). */
function getPropertyId(property: Property): string {
  return property.uuid || property._tempId || ''
}

/** Stable empty array to prevent re-render loops from default param. */
const EMPTY_PROPERTIES: Property[] = []

export interface UsePropertyEditorProps {
  initialProperties?: Property[]
  objectUuid?: string
}

export interface UsePropertyEditorReturn {
  /** Visible properties (non-deleted) */
  properties: Property[]
  /** Set of expanded property IDs */
  expandedIds: Set<string>
  /** Toggle a property's expanded state */
  toggleExpand: (id: string) => void
  /** Add a new empty property */
  addProperty: () => void
  /** Update a property's name/key */
  updatePropertyName: (propertyId: string, key: string, label: string) => void
  /** Update a property value's text */
  updatePropertyValue: (
    propertyId: string,
    valueIndex: number,
    value: string
  ) => void
  /** Update a property value's formula data */
  updatePropertyValueFormula: (
    propertyId: string,
    valueIndex: number,
    formulaData: FormulaData | undefined
  ) => void
  /** Add a new empty value to a property */
  addValue: (propertyId: string) => void
  /** Remove a value from a property */
  removeValue: (propertyId: string, valueIndex: number) => void
  /** Mark a property for removal (or delete if new) */
  removeProperty: (propertyId: string) => void
  /** Save all changed properties (batch) */
  saveProperties: () => Promise<void>
  /** Save a single property by ID */
  saveProperty: (propertyId: string) => Promise<void>
  /** Whether any properties have unsaved changes */
  hasChanges: boolean
  /** ID of property currently being saved */
  isSavingProperty: string | null
  /** Get available sibling properties for formula mapping */
  availablePropertiesFor: (propertyId: string) => AvailableProperty[]
  /** Reset edited state back to initial properties (e.g. on cancel) */
  resetProperties: () => void
  /** Map of propertyId -> validation error message for the name field */
  nameErrors: Record<string, string>
  /** Validate all visible properties; populates nameErrors. Returns true if valid. */
  validateProperties: () => boolean
}

/**
 * Single source of truth for property editing.
 * Manages all property state (UI + persistence) — no external
 * setters needed. Consumers interact exclusively through methods.
 */
export function usePropertyEditor({
  initialProperties = EMPTY_PROPERTIES,
  objectUuid,
}: UsePropertyEditorProps): UsePropertyEditorReturn {
  // All properties including those marked for deletion
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isSavingProperty, setIsSavingProperty] = useState<string | null>(null)
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({})
  // Monotonic counter ensures addProperty() produces a unique _tempId even
  // when called multiple times within the same millisecond (otherwise
  // updateById would apply updates to every prop sharing the tempId, and
  // formula variable mappings keyed by composite ID would collide).
  const tempIdCounterRef = useRef(0)

  const {
    updatePropertyWithValues,
    createPropertyForObject,
    removePropertyFromObject,
    softDeleteValue,
    createFormulaCalcForValue,
    deleteFormulaCalcForValue,
  } = usePropertyManagement()
  const t = useTranslations()

  // ── Sync from server data ────────────────────────────────────────
  // Stabilize initialProperties reference: only react to actual content
  // changes, not new array references with the same data.
  const prevInitialRef = useRef<string>('')
  useEffect(() => {
    const key = JSON.stringify(
      initialProperties.map((p) => ({
        uuid: p.uuid,
        key: p.key,
        values: p.values?.map((v) => ({
          uuid: v.uuid,
          value: v.value,
          formulaData: v.formulaData,
        })),
      }))
    )
    if (key !== prevInitialRef.current) {
      prevInitialRef.current = key
      setAllProperties(
        initialProperties.map((prop) => ({
          ...prop,
          _modified: false,
          _isNew: prop._isNew || false,
          _deleted: false,
        }))
      )
      setNameErrors({})
    }
  }, [initialProperties])

  // ── Derived state ────────────────────────────────────────────────

  const properties = useMemo(
    () => allProperties.filter((p) => !p._deleted),
    [allProperties]
  )

  const hasChanges = allProperties.some((prop) =>
    hasPropertyChanged(prop, initialProperties as Property[])
  )

  // ── Internal helpers ─────────────────────────────────────────────

  const updateById = useCallback(
    (propertyId: string, updater: (prop: Property) => Property) => {
      setAllProperties((prev) =>
        prev.map((p) => (getPropertyId(p) === propertyId ? updater(p) : p))
      )
    },
    []
  )

  // ── UI state methods ─────────────────────────────────────────────

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ── Mutation methods ─────────────────────────────────────────────

  const addProperty = useCallback(() => {
    tempIdCounterRef.current += 1
    const tempId = `temp_${Date.now()}_${tempIdCounterRef.current}`
    const newProperty: Property = {
      key: '',
      values: [{ value: '', _needsInput: true }],
      _isNew: true,
      _tempId: tempId,
    }
    setAllProperties((prev) => [...prev, newProperty])
    setExpandedIds((prev) => new Set(prev).add(tempId))
  }, [])

  const updatePropertyName = useCallback(
    (propertyId: string, key: string, label: string) => {
      updateById(propertyId, (prop) => ({
        ...prop,
        key,
        label,
        _modified: true,
      }))
      if (key.trim() !== '') {
        setNameErrors((prev) => {
          if (!prev[propertyId]) return prev
          const next = { ...prev }
          delete next[propertyId]
          return next
        })
      }
    },
    [updateById]
  )

  const updatePropertyValue = useCallback(
    (propertyId: string, valueIndex: number, value: string) => {
      updateById(propertyId, (prop) => {
        const updatedValues = [...(prop.values || [])]
        updatedValues[valueIndex] = {
          ...updatedValues[valueIndex],
          value,
          ...(value !== '' ? { _needsInput: false } : {}),
        }
        return { ...prop, values: updatedValues, _modified: true }
      })
    },
    [updateById]
  )

  const updatePropertyValueFormula = useCallback(
    (
      propertyId: string,
      valueIndex: number,
      formulaData: FormulaData | undefined
    ) => {
      updateById(propertyId, (prop) => {
        const updatedValues = [...(prop.values || [])]
        updatedValues[valueIndex] = {
          ...updatedValues[valueIndex],
          formulaData,
        }
        return { ...prop, values: updatedValues, _modified: true }
      })
    },
    [updateById]
  )

  const addValue = useCallback(
    (propertyId: string) => {
      updateById(propertyId, (prop) => ({
        ...prop,
        values: [...(prop.values || []), { value: '', _needsInput: true }],
        _modified: true,
      }))
    },
    [updateById]
  )

  const removeValue = useCallback(
    (propertyId: string, valueIndex: number) => {
      updateById(propertyId, (prop) => {
        const updatedValues = [...(prop.values || [])]
        updatedValues.splice(valueIndex, 1)
        return { ...prop, values: updatedValues, _modified: true }
      })
    },
    [updateById]
  )

  const removeProperty = useCallback((propertyId: string) => {
    setAllProperties((prev) => {
      const prop = prev.find((p) => getPropertyId(p) === propertyId)
      if (!prop) return prev

      if (prop._isNew) {
        return prev.filter((p) => getPropertyId(p) !== propertyId)
      }
      return prev.map((p) =>
        getPropertyId(p) === propertyId ? { ...p, _deleted: true } : p
      )
    })
    setNameErrors((prev) => {
      if (!prev[propertyId]) return prev
      const next = { ...prev }
      delete next[propertyId]
      return next
    })
  }, [])

  const resetProperties = useCallback(() => {
    setAllProperties(
      initialProperties.map((prop) => ({
        ...prop,
        _modified: false,
        _isNew: prop._isNew || false,
        _deleted: false,
      }))
    )
    setNameErrors({})
  }, [initialProperties])

  const validateProperties = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    const errorMsg = t('objects.propertyNameRequired')
    allProperties.forEach((prop) => {
      if (prop._deleted) return
      if (!prop.key || prop.key.trim() === '') {
        const id = getPropertyId(prop)
        if (id) errors[id] = errorMsg
      }
    })
    setNameErrors(errors)
    if (Object.keys(errors).length > 0) {
      // Ensure invalid rows are visible
      setExpandedIds((prev) => {
        const next = new Set(prev)
        Object.keys(errors).forEach((id) => next.add(id))
        return next
      })
      return false
    }
    return true
  }, [allProperties, t])

  // ── Available properties for formula mapping ─────────────────────

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

  const availablePropertiesFor = useCallback(
    (propertyId: string): AvailableProperty[] => {
      return allAvailableProperties.filter(
        (p) => !isOwnCompositeId(p.uuid, propertyId)
      )
    },
    [allAvailableProperties]
  )

  // ── API operations ───────────────────────────────────────────────

  /**
   * Resolve a composite ID (e.g. "{propUUID}::0") to a real property value UUID
   * by scanning the current properties list. Only returns UUIDs that are
   * already known (already persisted) — for values created in the current
   * save session, callers must consult a local map first.
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

  /**
   * Phase 1: Create/update/delete the property and its values. For new
   * properties, records the (_tempId::index → real value UUID) mapping so
   * Phase 2 can resolve formula variables that reference values created in
   * this same save.
   */
  const persistPhase1 = useCallback(
    async (property: Property, uuidMap: Map<string, string>) => {
      if (!objectUuid) throw new Error('Missing objectUuid')

      if (property._deleted) {
        for (const val of property.values || []) {
          const calcUuid = val.formulaData?.calcUuid
          if (calcUuid) {
            await deleteFormulaCalcForValue(
              objectUuid,
              calcUuid,
              val.formulaData?.formulaUuid
            )
          }
        }
        const valueUuids = (property.values || [])
          .map((v) => v.uuid)
          .filter((u): u is string => !!u)
        await removePropertyFromObject(objectUuid, property.uuid!, valueUuids)
        return
      }

      if (property._isNew) {
        const nonEmptyValues = (property.values || []).filter(
          (val) =>
            val.value !== undefined &&
            val.value !== '' &&
            val._needsInput !== true
        )

        const newProperty = await createPropertyForObject(objectUuid, {
          key: property.key,
          label: property.label,
          values: nonEmptyValues,
        })

        const tempId = property._tempId
        const createdValues: Array<{ uuid: string; index: number }> =
          newProperty?._createdValues || []
        if (tempId) {
          for (const cv of createdValues) {
            if (cv?.uuid) {
              uuidMap.set(makeCompositeId(tempId, cv.index), cv.uuid)
            }
          }
        }
        return
      }

      // Existing property — update metadata + values (omit value for formulas
      // so the backend stays source of truth).
      const nonEmptyValues = (property.values || []).filter(
        (val) =>
          val.value !== undefined &&
          val.value !== '' &&
          val._needsInput !== true
      )
      const valuesToSend = nonEmptyValues.map((val) =>
        val.formulaData?.formulaUuid
          ? { uuid: val.uuid, valueTypeCast: val.valueTypeCast }
          : {
              uuid: val.uuid,
              value: val.value,
              valueTypeCast: val.valueTypeCast,
            }
      )

      await updatePropertyWithValues(
        { uuid: property.uuid!, key: property.key, label: property.label },
        valuesToSend
      )

      // Soft-delete values that existed on the server but were removed from
      // the editor. Formula-calc teardown for those removed values is handled
      // in Phase 2's `deletes` collection so it can run alongside other calc
      // deletes.
      const originalProp = initialProperties.find(
        (p) => p.uuid === property.uuid
      )
      const currentValueUuids = new Set(
        (property.values || [])
          .map((v) => v.uuid)
          .filter((uuid): uuid is string => !!uuid)
      )
      const removedValues = (originalProp?.values || []).filter(
        (v) => v.uuid && !currentValueUuids.has(v.uuid)
      )
      await Promise.all(
        removedValues.map((removed) => softDeleteValue(removed.uuid!))
      )
    },
    [
      objectUuid,
      initialProperties,
      updatePropertyWithValues,
      createPropertyForObject,
      removePropertyFromObject,
      softDeleteValue,
      deleteFormulaCalcForValue,
    ]
  )

  /**
   * Phase 2 — COLLECT step: figure out which formula calcs need to be created
   * or deleted, resolving each calc's args using the Phase-1 map first and
   * falling back to state lookup for already-persisted values. Does NOT
   * execute yet — the caller sequences creations by dependency order so a
   * formula that consumes another formula's result is created after the
   * upstream calc.
   */
  const collectPhase2Ops = useCallback(
    (
      property: Property,
      uuidMap: Map<string, string>
    ): {
      creates: FormulaCreateTask[]
      deletes: FormulaDeleteTask[]
      unresolvedCount: number
    } => {
      const creates: FormulaCreateTask[] = []
      const deletes: FormulaDeleteTask[] = []
      let unresolvedCount = 0

      if (!objectUuid || property._deleted) {
        return { creates, deletes, unresolvedCount }
      }

      const resolver = (compositeId: string): string | null =>
        uuidMap.get(compositeId) ?? resolveCompositeIdToValueUUID(compositeId)

      if (property._isNew) {
        const nonEmptyValues = (property.values || []).filter(
          (val) =>
            val.value !== undefined &&
            val.value !== '' &&
            val._needsInput !== true
        )
        const tempId = property._tempId
        for (let i = 0; i < nonEmptyValues.length; i++) {
          const val = nonEmptyValues[i]
          if (!val.formulaData?.formulaUuid) continue
          const resultUuid = tempId
            ? uuidMap.get(makeCompositeId(tempId, i))
            : undefined
          if (!resultUuid) continue

          const { args, unresolved } = buildFormulaArgs(
            val.formulaData,
            resolver
          )
          unresolvedCount += unresolved.length
          if (args.length > 0) {
            creates.push({
              formulaData: val.formulaData,
              args,
              resultUuid,
            })
          }
        }
        return { creates, deletes, unresolvedCount }
      }

      // Existing property — handle text↔formula transitions on known values.
      const nonEmptyValues = (property.values || []).filter(
        (val) =>
          val.value !== undefined &&
          val.value !== '' &&
          val._needsInput !== true
      )
      const originalProp = initialProperties.find(
        (p) => p.uuid === property.uuid
      )

      // Tear down formula calcs for values that existed on the server but
      // were removed from the editor. The value itself is already soft-deleted
      // in Phase 1; here we only queue its calc teardown so Phase 2 can run
      // it alongside other formula deletes.
      const currentValueUuids = new Set(
        (property.values || [])
          .map((v) => v.uuid)
          .filter((uuid): uuid is string => !!uuid)
      )
      const removedValues = (originalProp?.values || []).filter(
        (v) => v.uuid && !currentValueUuids.has(v.uuid)
      )
      for (const removed of removedValues) {
        const calcUuid = removed.formulaData?.calcUuid
        if (calcUuid) {
          deletes.push({
            calcUuid,
            formulaUuid: removed.formulaData?.formulaUuid,
          })
        }
      }

      for (const val of nonEmptyValues) {
        if (!val.uuid) continue
        const origVal = originalProp?.values?.find((v) => v.uuid === val.uuid)
        const hadFormula = !!origVal?.formulaData?.formulaUuid
        const hasFormula = !!val.formulaData?.formulaUuid

        if (!hadFormula && hasFormula) {
          const { args, unresolved } = buildFormulaArgs(
            val.formulaData!,
            resolver
          )
          unresolvedCount += unresolved.length
          if (args.length > 0) {
            creates.push({
              formulaData: val.formulaData!,
              args,
              resultUuid: val.uuid,
            })
          }
        } else if (hadFormula && !hasFormula) {
          const calcUuid = origVal?.formulaData?.calcUuid
          if (calcUuid) {
            deletes.push({
              calcUuid,
              formulaUuid: origVal?.formulaData?.formulaUuid,
            })
          }
        }
      }
      return { creates, deletes, unresolvedCount }
    },
    [
      objectUuid,
      initialProperties,
      resolveCompositeIdToValueUUID,
      buildFormulaArgs,
    ]
  )

  /**
   * Execute collected Phase-2 operations with correct ordering. Deletes run
   * in parallel. Creates are topologically sorted by their inter-calc
   * dependencies (a calc whose args reference another calc's resultUuid
   * must run AFTER that upstream calc) and then executed in dependency
   * order. Independent calcs still run in parallel within each topological
   * layer.
   */
  const executePhase2 = useCallback(
    async (creates: FormulaCreateTask[], deletes: FormulaDeleteTask[]) => {
      if (!objectUuid) return

      // Deletes are independent of creates and of each other.
      const deleteOps = deletes.map((d) =>
        deleteFormulaCalcForValue(objectUuid, d.calcUuid, d.formulaUuid)
      )

      // Topologically sort creates by dependency. A create depends on
      // another create when its arg UUIDs include the other's resultUuid.
      const taskByResult = new Map<string, FormulaCreateTask>()
      for (const t of creates) taskByResult.set(t.resultUuid, t)

      const sorted: FormulaCreateTask[] = []
      const visited = new Set<string>()
      const visiting = new Set<string>()

      const visit = (task: FormulaCreateTask) => {
        if (visited.has(task.resultUuid)) return
        if (visiting.has(task.resultUuid)) {
          // Cycle — log and break so we don't loop forever. The calc will
          // still be queued, but its upstream hasn't completed first.
          logger.warn('Formula dependency cycle detected', {
            resultUuid: task.resultUuid,
          })
          return
        }
        visiting.add(task.resultUuid)
        for (const arg of task.args) {
          const upstream = taskByResult.get(arg.propertyValueUUID)
          if (upstream && upstream !== task) visit(upstream)
        }
        visiting.delete(task.resultUuid)
        visited.add(task.resultUuid)
        sorted.push(task)
      }
      for (const t of creates) visit(t)

      // Run creates sequentially in topological order so each formula calc
      // exists on the backend before any dependent formula references it.
      const createSequence = (async () => {
        for (const t of sorted) {
          await createFormulaCalcForValue(
            objectUuid,
            t.formulaData,
            t.args,
            t.resultUuid
          )
        }
      })()

      await Promise.all([...deleteOps, createSequence])
    },
    [objectUuid, createFormulaCalcForValue, deleteFormulaCalcForValue]
  )

  const saveProperties = useCallback(async (): Promise<void> => {
    if (!objectUuid) {
      throw new Error('Missing required data for property update')
    }

    const propertiesToUpdate = getChangedProperties(
      allProperties,
      initialProperties as Property[]
    )

    if (propertiesToUpdate.length === 0) {
      return
    }

    const uuidMap = new Map<string, string>()

    try {
      // Phase 1: persist property/value changes and collect new UUIDs.
      await Promise.all(
        propertiesToUpdate.map((prop) => persistPhase1(prop, uuidMap))
      )

      // Phase 2 collect: gather all formula calc creates/deletes with
      // fully-resolved args from a single shared uuidMap.
      const allCreates: FormulaCreateTask[] = []
      const allDeletes: FormulaDeleteTask[] = []
      let totalUnresolved = 0
      for (const prop of propertiesToUpdate) {
        const { creates, deletes, unresolvedCount } = collectPhase2Ops(
          prop,
          uuidMap
        )
        allCreates.push(...creates)
        allDeletes.push(...deletes)
        totalUnresolved += unresolvedCount
      }

      // Phase 2 execute: topologically sorted creates + parallel deletes.
      await executePhase2(allCreates, allDeletes)

      toast.success(t('objects.propertiesUpdated'))
      if (totalUnresolved > 0) {
        toast.warning(t('objects.formulaUnresolvedArgs'))
      }
    } catch (error) {
      logger.error('Error saving properties:', error)
      toast.error(
        isForbiddenError(error)
          ? t('objects.permissionDenied')
          : t('objects.propertiesUpdateFailed')
      )
      throw error
    }
  }, [
    objectUuid,
    allProperties,
    initialProperties,
    persistPhase1,
    collectPhase2Ops,
    executePhase2,
    t,
  ])

  const saveProperty = useCallback(
    async (propertyId: string): Promise<void> => {
      const property = allProperties.find(
        (p) => getPropertyId(p) === propertyId
      )
      if (!property || !objectUuid) {
        throw new Error('Missing property or objectUuid')
      }

      setIsSavingProperty(propertyId)

      const uuidMap = new Map<string, string>()

      try {
        await persistPhase1(property, uuidMap)
        const { creates, deletes, unresolvedCount } = collectPhase2Ops(
          property,
          uuidMap
        )
        await executePhase2(creates, deletes)
        toast.success(t('objects.propertiesUpdated'))
        if (unresolvedCount > 0) {
          toast.warning(t('objects.formulaUnresolvedArgs'))
        }
      } catch (error) {
        logger.error('Error saving property:', error)
        toast.error(
          isForbiddenError(error)
            ? t('objects.permissionDenied')
            : t('objects.propertiesUpdateFailed')
        )
        throw error
      } finally {
        setIsSavingProperty(null)
      }
    },
    [
      objectUuid,
      allProperties,
      persistPhase1,
      collectPhase2Ops,
      executePhase2,
      t,
    ]
  )

  return {
    properties,
    expandedIds,
    toggleExpand,
    addProperty,
    updatePropertyName,
    updatePropertyValue,
    updatePropertyValueFormula,
    addValue,
    removeValue,
    removeProperty,
    saveProperties,
    saveProperty,
    hasChanges,
    isSavingProperty,
    availablePropertiesFor,
    resetProperties,
    nameErrors,
    validateProperties,
  }
}
