/**
 * Utilities for composite IDs used to uniquely identify property values.
 *
 * Two formats exist:
 * - Index-based: `prop-{propIndex}::{valueIndex}` — used during creation
 * - UUID-based: `{propertyUUID}::{valueIndex}` — used during editing
 *
 * Both use `::` as the separator between property identifier and value index.
 */

const SEPARATOR = '::'

/**
 * Create a composite ID from a property identifier and value index.
 */
export function makeCompositeId(
  propertyId: string,
  valueIndex: number
): string {
  return `${propertyId}${SEPARATOR}${valueIndex}`
}

/**
 * Parse a composite ID back into its property identifier and value index.
 * Returns null if the string is not a valid composite ID.
 */
export function parseCompositeId(
  compositeId: string
): { propertyId: string; valueIndex: number } | null {
  const separatorIndex = compositeId.lastIndexOf(SEPARATOR)
  if (separatorIndex === -1) return null

  const propertyId = compositeId.slice(0, separatorIndex)
  const valueIndexStr = compositeId.slice(separatorIndex + SEPARATOR.length)
  const valueIndex = parseInt(valueIndexStr, 10)

  if (!propertyId || isNaN(valueIndex) || valueIndex < 0) return null

  return { propertyId, valueIndex }
}

/**
 * Check whether a composite ID belongs to the given property.
 */
export function isOwnCompositeId(
  compositeId: string,
  propertyId: string
): boolean {
  return compositeId.startsWith(`${propertyId}${SEPARATOR}`)
}

/**
 * Create an index-based composite ID used during object creation.
 * Format: `prop-{propIndex}::{valueIndex}`
 */
export function makeIndexCompositeId(
  propIndex: number,
  valueIndex: number
): string {
  return makeCompositeId(`prop-${propIndex}`, valueIndex)
}
