'use client'

import type { Attachment } from '@/types'
import { logger } from './logger'
import { useSDKStore } from '@/stores'

// Updated client type for new flow with uploadDirect and uploadByReference methods
type ApiClient = {
  node: {
    uploadFileDirect: (input: {
      file: File | Blob | ArrayBuffer | FormData
      uuidToAttach: string
      label?: string
      fileName?: string
      contentType?: string
      size?: number
    }) => Promise<any>
    uploadFileByReference: (input: {
      fileName: string
      fileReference: string
      uuidToAttach: string
      label?: string
      contentType?: string
      size?: number
    }) => Promise<any>
  }
}

export interface FileUploadTask {
  id: string
  attachment: Attachment
  // Context for creating relationships
  objectUuid?: string
  propertyUuid?: string
  valueUuid?: string
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  retries: number
  error?: string
}

export interface FileUploadOptions {
  maxRetries?: number
  maxConcurrent?: number
  onProgress?: (taskId: string, progress: number) => void
  onComplete?: (taskId: string) => void
  onError?: (taskId: string, error: string) => void
}

/**
 * Simplified service for handling binary file uploads to existing file records
 * The import API already creates file records and relationships
 */
export class FileUploadService {
  private client: ApiClient
  private uploadQueue: FileUploadTask[] = []
  private processing = false
  private options: Required<FileUploadOptions>

  constructor(client: ApiClient, options?: FileUploadOptions) {
    if (!client) {
      throw new Error('API client is required for FileUploadService')
    }

    this.client = client
    this.options = {
      maxRetries: 3,
      maxConcurrent: 3,
      onProgress: () => {},
      onComplete: () => {},
      onError: () => {},
      ...options,
    }
  }

  /**
   * Add a file to the upload queue
   */
  addFile(task: FileUploadTask) {
    this.uploadQueue.push(task)
    this.processQueue()
  }

  /**
   * Process the upload queue
   */
  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.uploadQueue.length > 0) {
      const task = this.uploadQueue.shift()
      if (!task) continue

      try {
        await this.uploadFile(task)
      } catch (error: any) {
        logger.error(`File upload failed for task ${task.id}:`, error)
        task.status = 'failed'
        task.error = error.message
        this.options.onError(task.id, error.message)
      }
    }

    this.processing = false
  }

  /**
   * Upload a single file
   */
  private async uploadFile(task: FileUploadTask) {
    if (!this.client?.node) {
      throw new Error('SDK client node service not available')
    }

    task.status = 'uploading'
    task.progress = 0
    this.options.onProgress(task.id, 0)

    const uuidToAttach = task.objectUuid || task.propertyUuid || task.valueUuid

    if (!uuidToAttach) {
      throw new Error('No UUID provided to attach the file to')
    }

    this.options.onProgress(task.id, 50)

    let response
    if (task.attachment.mode === 'reference') {
      // Use uploadFileByReference for external file references
      const fileReference = task.attachment.fileReference || task.attachment.url
      if (!fileReference) {
        throw new Error('File reference URL is required for reference uploads')
      }

      const uploadData = {
        fileName: task.attachment.fileName || '',
        fileReference: fileReference,
        uuidToAttach: uuidToAttach,
        contentType: task.attachment.mimeType,
        size: task.attachment.size,
        label: task.attachment.label,
      }

      response = await this.client.node.uploadFileByReference(uploadData)
    } else {
      // Use the new uploadFileDirect method for file uploads
      if (!task.attachment.blob) {
        throw new Error('Blob is required for direct uploads')
      }

      response = await this.client.node.uploadFileDirect({
        file: task.attachment.blob,
        uuidToAttach: uuidToAttach,
        fileName: task.attachment.fileName,
        contentType: task.attachment.mimeType,
        size: task.attachment.size,
        label: task.attachment.label,
      })
    }

    this.options.onProgress(task.id, 100)

    task.status = 'completed'
    this.options.onComplete(task.id)
    return response
  }

  /**
   * Get the current queue status
   */
  getQueueStatus() {
    return this.uploadQueue.map((task) => ({
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error,
    }))
  }
}

// Singleton instance
let uploadService: FileUploadService | null = null

export function getUploadService() {
  const client = useSDKStore.getState().client
  if (!client) {
    throw new Error('SDK client is not initialized. Cannot get Upload Service.')
  }
  if (!uploadService) {
    uploadService = new FileUploadService(client)
  }
  return uploadService
}
