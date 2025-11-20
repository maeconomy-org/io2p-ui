/**
 * Utility functions for object sheet operations
 */

export interface ModelLookupResult {
  model: any | null
  hasModel: boolean
}

/**
 * Find model data for a given object
 */
export function findModelForObject(
  object: any,
  availableModels: any[]
): ModelLookupResult {
  if (!object?.modelUuid || !availableModels?.length) {
    return { model: null, hasModel: false }
  }

  const model = availableModels.find((m) => m.uuid === object.modelUuid)
  return {
    model: model || null,
    hasModel: !!model,
  }
}

/**
 * Create an empty property structure for form use
 */
export function createEmptyProperty() {
  return {
    uuid: '',
    key: '',
    values: [
      {
        uuid: '',
        value: '',
        formula: '',
        files: [],
      },
    ],
    files: [],
  }
}

/**
 * Check if an object appears to be deleted
 */
export function isObjectDeleted(object: any): boolean {
  return !!(object?.softDeleted || object?.isDeleted)
}

/**
 * Format a display name for an object (with fallbacks)
 */
export function getObjectDisplayName(object: any): string {
  if (!object) return 'Unknown Object'
  return object.name || object.uuid || 'Unnamed Object'
}

/**
 * Get formatted creation/update timestamps
 */
export function getObjectTimestamps(object: any) {
  const created = object?.createdAt
    ? new Date(object.createdAt).toLocaleString()
    : null
  const updated = object?.lastUpdatedAt
    ? new Date(object.lastUpdatedAt).toLocaleString()
    : null

  return { created, updated }
}

/**
 * Get soft delete information if available
 */
export function getSoftDeleteInfo(object: any) {
  if (!isObjectDeleted(object)) {
    return null
  }

  return {
    deletedAt: object?.softDeletedAt
      ? new Date(object.softDeletedAt).toLocaleString()
      : null,
    deletedBy: extractUserUUID(object?.softDeleteBy),
  }
}

/**
 * Extract user UUID from user object or return the value if it's already a string
 */
export function extractUserUUID(userField: any): string | null {
  if (!userField) return null
  if (typeof userField === 'string') return userField
  return userField.userUUID || userField.uuid || null
}

/**
 * Truncate long text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

/**
 * Format soft delete user information for display
 */
export function formatSoftDeleteBy(
  deleteBy: string,
  maxLength: number = 30
): string {
  if (!deleteBy) return ''

  if (deleteBy.length <= maxLength) return deleteBy

  return `...${deleteBy.substring(deleteBy.length - maxLength)}`
}
