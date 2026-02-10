import { useMutation } from '@tanstack/react-query'
import { useIomSdkClient } from '@/contexts'

/**
 * Import API object structure based on the provided schema
 */
export interface ImportObjectData {
  name: string
  abbreviation?: string
  version?: string
  description?: string
  isTemplate?: boolean
  address?: {
    fullAddress: string
    street: string
    houseNumber: string
    city: string
    postalCode: string
    country: string
    state?: string
    district?: string
  }
  parents?: string[]
  files?: Array<{
    fileName: string
    fileReference: string
    label?: string
    contentType?: string
    size?: number
  }>
  properties?: Array<{
    key: string
    label?: string
    type?: string
    values?: Array<{
      value: string
      valueTypeCast?: string
      sourceType?: string
      files?: Array<{
        uuid: string
        fileName: string
        fileReference: string
        label?: string
        contentType?: string
        size?: number
      }>
    }>
    files?: Array<{
      uuid: string
      fileName: string
      fileReference: string
      label?: string
      contentType?: string
      size?: number
    }>
  }>
}

/**
 * Result from import API
 */
export interface ImportResult {
  success: boolean
  message?: string
  data?: any
}

/**
 * Hook for using the import API directly from client-side
 */
export function useImportApi() {
  const client = useIomSdkClient()

  const importSingleObject = useMutation({
    mutationFn: async (objectData: ImportObjectData): Promise<any> => {
      const response = await client.node.createAggregates([objectData])
      return response
    },
  })

  return {
    importSingleObject,
    isImporting: importSingleObject.isPending,
  }
}
