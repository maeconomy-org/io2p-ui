'use client'

import type { Client } from 'iom-sdk'

import { logger } from '@/lib'

/**
 * Resolve a presigned download URL via the SDK (an authenticated GET — the JWT
 * is attached automatically) and navigate the browser to it. The presigned S3
 * URL has `Content-Disposition: attachment` baked in by the server, so the
 * browser streams the file straight to disk. The JWT never reaches S3.
 *
 * Note: for cross-origin presigned URLs the anchor `download` attribute is a
 * best-effort hint only — the server's `Content-Disposition` is what forces the
 * download and sets the filename.
 */
export async function downloadFileToClient(
  client: Client,
  fileReference: string,
  fileName: string
): Promise<void> {
  try {
    const { url } = await client.fileStorage.getDownloadUrl(fileReference)
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
