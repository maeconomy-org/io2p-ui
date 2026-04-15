import type { Property } from '../types'

/**
 * Check if a single property has changed relative to the original properties list.
 * Detects: new, deleted, modified key, modified values, formula changes.
 */
export function hasPropertyChanged(
  property: Property,
  originalProperties: Property[]
): boolean {
  // Properties flagged by the editing system
  if (property._isNew || property._deleted || property._modified) {
    return true
  }

  // Find the original property to compare against
  const originalProp = originalProperties.find((p) => p.uuid === property.uuid)
  if (!originalProp) return false

  // Key changed
  if (property.key !== originalProp.key) return true

  // Values length changed
  if (property.values?.length !== originalProp.values?.length) return true

  // Any value content or formula changed
  const valuesChanged = property.values?.some((val, i) => {
    const origVal = originalProp.values?.[i]
    if (!origVal || val.value !== origVal.value) return true

    // Check formula changes
    const hasNewFormula = !!val.formulaData?.formulaUuid
    const hadOldFormula = !!origVal.formulaData?.formulaUuid
    if (hasNewFormula !== hadOldFormula) return true
    if (
      hasNewFormula &&
      hadOldFormula &&
      val.formulaData!.formulaUuid !== origVal.formulaData!.formulaUuid
    )
      return true

    return false
  })

  return valuesChanged ?? false
}

/**
 * Filter a list of edited properties to only those that have changed.
 */
export function getChangedProperties(
  editedProperties: Property[],
  originalProperties: Property[]
): Property[] {
  return editedProperties.filter((prop) =>
    hasPropertyChanged(prop, originalProperties)
  )
}
