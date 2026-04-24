'use client'

import { useEffect, useState } from 'react'

import { useIomSdkClient } from '@/contexts'
import { logger } from '@/lib'

/**
 * Extracts the UUFile UUID from a stored file reference like
 * `/api/UUFile/{uuid}/download`. Returns null if the reference is external
 * or malformed.
 */
export function extractFileUuid(fileReference?: string | null): string | null {
  if (!fileReference) return null
  const match = fileReference.match(/\/api\/UUFile\/([^/?]+)\/download/)
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
      .downloadFile(uuid)
      .then((arrayBuffer: ArrayBuffer) => {
        if (cancelled) return
        const blob = new Blob([arrayBuffer], {
          type: mimeType || 'application/octet-stream',
        })
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
