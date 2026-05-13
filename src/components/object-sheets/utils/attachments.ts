import type { Attachment } from '@/types'

export function isOversize(file: File, maxMB: number): boolean {
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
 * True when `fileReference` is a URL pointing at an external resource
 * (`https://...`). For S3-backed files the `fileReference` is a storage UUID
 * — opaque, not a URL — and must be resolved via the file-storage service
 * (`client.fileStorage.getPreviewUrl` / `getDownloadUrl`).
 *
 * Discriminator: try to parse as a URL with a non-empty protocol. UUIDs and
 * other opaque tokens fail this and are treated as internal references.
 */
export function isExternalFileReference(fileReference?: string): boolean {
  if (!fileReference) return false
  try {
    const parsed = new URL(fileReference)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
