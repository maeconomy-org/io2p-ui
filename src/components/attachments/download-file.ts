'use client'

import type { Client } from 'iom-sdk'

import { logger } from '@/lib'

/**
 * Navigate to `/api/FileStorage/{fileReference}/download` — the backend 302s
 * to a presigned S3 URL with `Content-Disposition: attachment` baked in, so
 * the browser streams the file straight to disk.
 */
export function downloadFileToClient(
  client: Client,
  fileReference: string,
  fileName: string
): void {
  try {
    const { url } = client.fileStorage.getDownloadUrl(fileReference)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (err) {
    logger.error('File download failed', { fileReference, error: err })
    throw err
  }
}
