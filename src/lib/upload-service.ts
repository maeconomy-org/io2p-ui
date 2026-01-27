'use client'

import type { Attachment } from '@/types'
import { logger } from './logger'
import { useIomSdkClient } from '@/contexts'
import type { Client } from 'iom-sdk'

// Use the actual SDK Client type
type ApiClient = Client

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
        file: task.attachment.blob as File,
        uuidToAttach: uuidToAttach,
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

  /**
   * Queue file uploads with context (for object creation)
   */
  queueFileUploadsWithContext(fileContexts: any[]) {
    fileContexts.forEach((context) => {
      this.addFile({
        id: `upload-${Date.now()}-${Math.random()}`,
        attachment: context.attachment,
        objectUuid: context.objectUuid,
        propertyUuid: context.propertyUuid,
        valueUuid: context.valueUuid,
        status: 'pending',
        progress: 0,
        retries: 0,
      })
    })
    return Promise.resolve()
  }

  /**
   * Get upload summary
   */
  getUploadSummary() {
    const completed = this.uploadQueue.filter(
      (task) => task.status === 'completed'
    )
    const failed = this.uploadQueue.filter((task) => task.status === 'failed')
    const pending = this.uploadQueue.filter((task) => task.status === 'pending')
    const uploading = this.uploadQueue.filter(
      (task) => task.status === 'uploading'
    )

    return {
      completed,
      failed,
      pending,
      uploading,
      total: this.uploadQueue.length,
    }
  }

  /**
   * Clear completed uploads
   */
  clearCompleted() {
    this.uploadQueue = this.uploadQueue.filter(
      (task) => task.status !== 'completed'
    )
  }
}

// Hook to get upload service within React components
export function useUploadService(): FileUploadService {
  const client = useIomSdkClient() // Always defined (blocking load)

  // Note: Creates new instance each time - consider useMemo if needed
  return new FileUploadService(client)
}

// Legacy function for non-React contexts (will be phased out)
export function getUploadService() {
  // This is a fallback for components that haven't been updated yet
  // We'll gradually replace all usages with the hook
  throw new Error(
    'getUploadService() is deprecated. Use useUploadService() hook instead.'
  )
}
