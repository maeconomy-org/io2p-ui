'use client'

import type { Client } from 'iom-sdk'

import { logger } from '@/lib'
import { base64ToBlob } from './base64'

export async function downloadFileToClient(
  client: Client,
  uuid: string,
  mimeType: string,
  fileName: string
): Promise<void> {
  let blobUrl: string | null = null
  try {
    const base64 = await client.node.getFileContent(uuid)
    if (!base64) {
      throw new Error(`File ${uuid} has no content`)
    }
    const blob = await base64ToBlob(base64, mimeType)
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
