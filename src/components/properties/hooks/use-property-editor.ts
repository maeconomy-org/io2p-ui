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
  updatePropertyName: (propertyId: string, name: string) => void
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

  const {
    updatePropertyWithValues,
    createPropertyForObject,
    removePropertyFromObject,
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
    const tempId = `temp_${Date.now()}`
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
    (propertyId: string, name: string) => {
      updateById(propertyId, (prop) => ({
        ...prop,
        key: name,
        _modified: true,
      }))
      if (name.trim() !== '') {
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
   * by scanning the current properties list.
   */
  const resolveCompositeIdToValueUUID = useCallback(
    (compositeId: string): string | null => {
      const parsed = parseCompositeId(compositeId)
      if (!parsed) return null

      const { propertyId, valueIndex } = parsed
      // Find the property by uuid or _tempId
      const prop = allProperties.find(
        (p) => p.uuid === propertyId || p._tempId === propertyId
      )
      return prop?.values?.[valueIndex]?.uuid || null
    },
    [allProperties]
  )

  /**
   * Build formula calc args by resolving composite IDs to real value UUIDs.
   */
  const buildFormulaArgs = useCallback(
    (
      formulaData: FormulaData
    ): Array<{ name: string; propertyValueUUID: string }> => {
      const args: Array<{ name: string; propertyValueUUID: string }> = []
      for (const [name, mapping] of Object.entries(
        formulaData.variableMapping || {}
      )) {
        const realUUID = resolveCompositeIdToValueUUID(mapping.propertyUuid)
        logger.info('Resolving formula arg:', {
          varName: name,
          compositeId: mapping.propertyUuid,
          resolvedUUID: realUUID,
        })
        if (realUUID) {
          args.push({ name, propertyValueUUID: realUUID })
        }
      }
      return args
    },
    [resolveCompositeIdToValueUUID]
  )

  const processPropertyOperations = useCallback(
    async (property: Property) => {
      if (!objectUuid) throw new Error('Missing objectUuid')

      if (property._deleted) {
        // Check if this property had a formula calc to clean up
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
        await removePropertyFromObject(objectUuid, property.uuid!)
        return
      }

      if (property._isNew) {
        const nonEmptyValues = (property.values || []).filter(
          (val) =>
            val.value !== undefined &&
            val.value !== '' &&
            val._needsInput !== true
        )

        // Create the property and its values first (sequential — need UUIDs back)
        const newProperty = await createPropertyForObject(objectUuid, {
          key: property.key,
          values: nonEmptyValues,
        })

        // Now create formula calcs for any formula values
        for (let i = 0; i < nonEmptyValues.length; i++) {
          const val = nonEmptyValues[i]
          if (!val.formulaData?.formulaUuid) continue

          // Find the created value UUID from the response
          const createdValue = newProperty?._createdValues?.find(
            (cv: { index: number }) => cv.index === i
          )
          if (!createdValue?.uuid) continue

          const args = buildFormulaArgs(val.formulaData)
          if (args.length > 0) {
            await createFormulaCalcForValue(
              objectUuid,
              val.formulaData,
              args,
              createdValue.uuid
            )
          }
        }
        return
      }

      // Existing property — update metadata and values
      const nonEmptyValues = (property.values || []).filter(
        (val) =>
          val.value !== undefined &&
          val.value !== '' &&
          val._needsInput !== true
      )

      const operations = []

      // For formula values, omit `value` so backend computes it as source of truth
      const valuesToSend = nonEmptyValues.map((val) =>
        val.formulaData?.formulaUuid
          ? { uuid: val.uuid, valueTypeCast: val.valueTypeCast }
          : {
              uuid: val.uuid,
              value: val.value,
              valueTypeCast: val.valueTypeCast,
            }
      )

      operations.push(
        updatePropertyWithValues(
          {
            uuid: property.uuid!,
            key: property.key,
          },
          valuesToSend
        )
      )

      // Handle formula changes (text↔formula conversion)
      const originalProp = initialProperties.find(
        (p) => p.uuid === property.uuid
      )
      for (const val of nonEmptyValues) {
        if (!val.uuid) continue
        const origVal = originalProp?.values?.find((v) => v.uuid === val.uuid)
        const hadFormula = !!origVal?.formulaData?.formulaUuid
        const hasFormula = !!val.formulaData?.formulaUuid

        if (!hadFormula && hasFormula) {
          const args = buildFormulaArgs(val.formulaData!)
          if (args.length > 0) {
            operations.push(
              createFormulaCalcForValue(
                objectUuid,
                val.formulaData!,
                args,
                val.uuid
              )
            )
          }
        } else if (hadFormula && !hasFormula) {
          const calcUuid = origVal?.formulaData?.calcUuid
          if (calcUuid) {
            operations.push(deleteFormulaCalcForValue(objectUuid, calcUuid))
          }
        }
      }

      await Promise.all(operations)
    },
    [
      objectUuid,
      initialProperties,
      allProperties,
      updatePropertyWithValues,
      createPropertyForObject,
      removePropertyFromObject,
      createFormulaCalcForValue,
      deleteFormulaCalcForValue,
      buildFormulaArgs,
    ]
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

    try {
      await Promise.all(
        propertiesToUpdate.map((prop) => processPropertyOperations(prop))
      )
      toast.success(t('objects.propertiesUpdated'))
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
    processPropertyOperations,
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

      try {
        await processPropertyOperations(property)
        toast.success(t('objects.propertiesUpdated'))
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
    [objectUuid, allProperties, processPropertyOperations, t]
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
