'use client'

import { useEffect, useState } from 'react'

import { useIomSdkClient } from '@/contexts'
import { logger } from '@/lib'
import { base64ToBlob } from './base64'

/**
 * Extracts the UUFile UUID from a stored internal file reference. Historically
 * the server returned `/api/UUFile/{uuid}/download`; the download endpoint is
 * gone, but any legacy references still carry the UUID we can extract.
 * Returns null for external URLs or malformed values.
 */
export function extractFileUuid(fileReference?: string | null): string | null {
  if (!fileReference) return null
  const match = fileReference.match(/\/api\/UUFile\/([^/?]+)/)
  return match ? match[1] : null
}

export interface UseFileBlobUrlResult {
  url: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch a file through the SDK and expose a blob: URL that lives for the
 * lifetime of the hook. The URL is revoked on unmount or when the uuid
 * changes so callers don't leak object URLs.
 *
 * Mirrors the existing auth pattern from file-display.tsx — the SDK attaches
 * the JWT, no browser-direct request is made.
 */
export function useFileBlobUrl(
  uuid: string | null | undefined,
  mimeType: string,
  enabled = true
): UseFileBlobUrlResult {
  const client = useIomSdkClient()
  const [url, setUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uuid || !enabled) {
      setUrl(null)
      return
    }

    let cancelled = false
    let createdUrl: string | null = null

    setIsLoading(true)
    setError(null)

    client.node
      .getFileContent(uuid)
      .then(async (base64: string | null) => {
        if (cancelled) return
        if (!base64) {
          setError(new Error(`File ${uuid} has no content`))
          return
        }
        const blob = await base64ToBlob(base64, mimeType)
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setUrl(createdUrl)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const wrapped = err instanceof Error ? err : new Error(String(err))
        logger.error('Failed to load file blob', { uuid, error: wrapped })
        setError(wrapped)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
      setUrl(null)
    }
  }, [uuid, mimeType, enabled, client])

  return { url, isLoading, error }
}
