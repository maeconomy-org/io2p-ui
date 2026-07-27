'use client'

import type { FileData } from '@/types'
import { isExternalFileReference } from '@/components/object-sheets/utils'
import { usePreviewUrl } from '@/hooks/api/use-files-api'

import { isAllowedExternalFileReference } from '@/lib/validations'

export interface UseFilePreviewUrlResult {
  url: string | null
  expiresAt: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Resolve a displayable URL for a file. External references (allowlisted
 * https URLs) pass through; internal files fetch a short-lived presigned URL
 * from the file-storage service. Viewer components consume the string as a
 * direct `src` — no Blob roundtrip, so the browser can stream and range-fetch.
 */
export function useFilePreviewUrl(
  file: Pick<FileData, 'uuid' | 'fileReference'> | null,
  enabled = true
): UseFilePreviewUrlResult {
  const isExternal = !!file && isExternalFileReference(file.fileReference)
  const externalUrl =
    isExternal && isAllowedExternalFileReference(file!.fileReference)
      ? file!.fileReference!
      : null
  const externalBlocked = isExternal && !externalUrl

  // Internal S3 files carry the storage UUID on `fileReference`. The node-side
  // UUFile `uuid` is irrelevant to the file-storage service.
  const internalRef =
    !isExternal && file?.fileReference ? file.fileReference : null
  const query = usePreviewUrl(internalRef, enabled && !!internalRef)

  if (!file || !enabled) {
    return { url: null, expiresAt: null, isLoading: false, error: null }
  }

  if (isExternal) {
    return {
      url: externalUrl,
      expiresAt: null,
      isLoading: false,
      error: externalBlocked
        ? new Error('External file reference is not on the allowlist')
        : null,
    }
  }

  return {
    url: query.data?.url ?? null,
    expiresAt: query.data?.expiresAt ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error) : null,
  }
}
