import type { Attachment } from '@/types'

export function isOversize(file: File, maxMB: number): boolean {
  const bytes = maxMB * 1024 * 1024
  return file.size > bytes
}

/** Generic fallback when the browser can't infer a MIME type. */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/**
 * Resolve a usable MIME type for a picked file.
 *
 * `File.type` is `''` whenever the OS has no registered mapping for the
 * extension — common for engineering / 3D-printing formats like `.gcode`,
 * `.stl`, `.step`. An empty `mimeType` then propagates into the FileStorage
 * `init` payload, which the API rejects. Always return a non-empty type so the
 * upload can proceed; unknown types fall back to `application/octet-stream`.
 */
export function resolveFileContentType(file: File): string {
  return file.type?.trim() || DEFAULT_CONTENT_TYPE
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
