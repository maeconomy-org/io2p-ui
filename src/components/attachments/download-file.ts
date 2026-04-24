'use client'

import type { Client } from 'iom-sdk'

import { logger } from '@/lib'

/**
 * Download a UUFile through the SDK (JWT attached automatically) and trigger
 * a browser download. Uses try/finally to guarantee the object URL is revoked
 * even if the DOM click flow throws mid-way.
 */
export async function downloadFileToClient(
  client: Client,
  uuid: string,
  mimeType: string,
  fileName: string
): Promise<void> {
  let blobUrl: string | null = null
  try {
    const buf = await client.node.downloadFile(uuid)
    const blob = new Blob([buf], {
      type: mimeType || 'application/octet-stream',
    })
    blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    logger.error('File download failed', { uuid, error: err })
    throw err
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}
