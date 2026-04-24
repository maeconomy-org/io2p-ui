import { MAX_FILE_SIZE_MB } from '@/constants'
import type { Attachment } from '@/types'

export function getMaxUploadSizeMB(): number {
  const envValue = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB
  const parsed = envValue ? Number(envValue) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : MAX_FILE_SIZE_MB
}

export function isOversize(file: File, maxMB = getMaxUploadSizeMB()): boolean {
  const bytes = maxMB * 1024 * 1024
  return file.size > bytes
}

export function bytesToReadable(size?: number): string {
  if (!size || size <= 0) return '0 B'
  const i = Math.floor(Math.log(size) / Math.log(1024))
  const value = (size / Math.pow(1024, i)).toFixed(2)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  return `${value} ${units[i]}`
}

export function isReferenceAttachment(att: Attachment): boolean {
  return att.mode === 'reference' && !!att.url
}

export function toApiFilePayload(att: Attachment): {
  file: {
    fileName: string
    fileReference?: string
    label?: string
    url?: string
  }
} {
  // Keep it generic to match createFullObject mapping
  return {
    file: {
      fileName: att.fileName || '',
      fileReference: att.fileReference,
      label: att.label,
    },
  }
}

/**
 * True when `fileReference` is a non-empty URL pointing at an external
 * resource (anything that is not an internal `/api/UUFile/...` path).
 * Internal files no longer carry a server-generated reference URL — file
 * content is fetched by `file.uuid` via `POST /api/UUFile/find`.
 */
export function isExternalFileReference(fileReference?: string): boolean {
  if (!fileReference) return false
  return !fileReference.includes('/api/UUFile/')
}
