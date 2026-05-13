'use client'

import type { Client } from 'iom-sdk'

import { logger } from '@/lib'

/**
 * Trigger a file download via a presigned URL. The backend signs the URL with
 * `response-content-disposition=attachment` so a plain anchor click downloads
 * — no Blob, no `URL.createObjectURL`, no memory copy of the full file.
 *
 * `fileReference` is the storage UUID (UUFileDTO.fileReference), not the node
 * UUFile UUID — file-storage indexes by its own identifier.
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
