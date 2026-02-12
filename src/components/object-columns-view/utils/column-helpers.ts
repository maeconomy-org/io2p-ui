// Define interfaces for column data
export interface Property {
  uuid: string
  key: string
  value?: string
  values?: { value: string }[]
}

export interface ObjectItem {
  uuid: string
  name: string
  modelUuid?: string
  modelName?: string
  modelVersion?: string
  properties?: Property[]
  children?: ObjectItem[]
  hasChildren?: boolean
  childCount?: number
  createdAt: string
  updatedAt: string
  files?: any[]
  softDeleted?: boolean
  softDeletedAt?: string
  softDeleteBy?: string
  description?: string
}

// Helper function to get column title
export function getColumnTitle(
  index: number,
  t?: (key: string, values?: Record<string, any>) => string
): string {
  if (!t) {
    return index === 0 ? 'Root Objects' : `Level ${index + 1}`
  }
  return index === 0
    ? t('objects.columnsView.rootObjects')
    : t('objects.columnsView.level', { level: index + 1 })
}

// Helper function to check if item has children
export function hasChildren(item: ObjectItem): boolean {
  return (
    Boolean(item.hasChildren) ||
    Boolean(item.children && item.children.length > 0)
  )
}

// Helper function to get model info
export function getModelInfo(item: ObjectItem) {
  return item.modelUuid
    ? { name: item.modelName, version: item.modelVersion }
    : null
}
