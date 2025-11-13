export type AttachmentMode = 'reference' | 'upload'

export type Attachment = {
  mode: AttachmentMode
  fileName?: string
  label?: string
  uuid?: string // Optional UUID for tracking
  // For external references
  url?: string
  // For uploaded files (server-side reference/token)
  fileReference?: string
  size?: number
  mimeType?: string
  // For actual file upload
  blob?: File | Blob
  // For associating with properties/values during upload
  context?: 'object' | 'property' | 'value'
  propertyKey?: string
  propertyIndex?: number // Index of property in properties array (for duplicate keys)
  valueIndex?: number
  // For soft delete support
  softDeleted?: boolean
  softDeletedAt?: string
}

export interface FileData {
  uuid: string
  fileName: string
  fileReference: string
  label?: string
  contentType?: string | null
  size?: number
  // Soft delete support
  softDeleted?: boolean
  softDeletedAt?: string | null
}
