/**
 * Local IoM Types
 * This file contains application-specific types that extend the iom-sdk package.
 * For base types, import directly from 'iom-sdk' instead of re-exporting here.
 */

import type {
  UUObjectDTO,
  UUPropertyDTO,
  UUPropertyValueDTO,
  UUFileDTO,
  UUID,
} from 'iom-sdk'

/**
 * Object update input type for the updateObject API
 */
export type ObjectUpdateInput = {
  object?: Partial<Omit<UUObjectDTO, 'uuid'>>
  parentUuid?: UUID | null
  addFiles?: Array<{
    file: Omit<UUFileDTO, 'uuid'>
  }>
  removeFiles?: UUID[]
  properties?: Array<{
    key: string
    property?: Partial<Omit<UUPropertyDTO, 'uuid'>>
    addValues?: Array<{
      value: Omit<UUPropertyValueDTO, 'uuid'>
      addFiles?: Array<{
        file: Omit<UUFileDTO, 'uuid'>
      }>
    }>
    removeValues?: UUID[]
    addFiles?: Array<{
      file: Omit<UUFileDTO, 'uuid'>
    }>
    removeFiles?: UUID[]
  }>
  removeProperties?: string[]
}

/**
 * React Query related types
 */
export type QueryOptions = {
  enabled?: boolean
  staleTime?: number
  refetchOnWindowFocus?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}

/**
 * Query filter options for API requests
 */
export type QueryFilters = {
  search?: string
  type?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

/**
 * Response object with pagination info
 */
export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * API hooks return types for consistent interface
 */
export type ObjectsHookReturns = {
  useAllObjects: (options?: QueryOptions) => any
  useObject: (uuid: UUID, options?: QueryOptions) => any
  useCreateObject: () => any
  useCreateFullObject: () => any
  useUpdateObjectMetadata: () => any
  useDeleteObject: () => any
}
