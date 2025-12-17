import type { Attachment } from '@/types'
import { logger } from './logger'

// Updated client type for new flow with uploadDirect and uploadByReference methods
type ApiClient = {
  files: {
    uploadDirect: (input: {
      file: File | Blob | ArrayBuffer | FormData
      uuidToAttach: string
    }) => Promise<{ data: any }>
    uploadByReference: (file: {
      fileName: string
      fileReference: string
      uuidToAttach: string
      label?: string
    }) => Promise<{ data: any }>
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

  constructor(client: ApiClient, options: FileUploadOptions = {}) {
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
   * Queue file uploads with specific context mapping for each file
   */
  async queueFileUploadsWithContext(
    fileContexts: Array<{
      attachment: Attachment
      objectUuid?: string
      propertyUuid?: string
      valueUuid?: string
    }>
  ): Promise<void> {
    const tasks: FileUploadTask[] = fileContexts
      .filter(({ attachment }) => {
        // Include upload files with blobs OR reference files with URLs
        return (
          (attachment.mode === 'upload' && attachment.blob) ||
          (attachment.mode === 'reference' &&
            (attachment.fileReference || attachment.url))
        )
      })
      .map(({ attachment, objectUuid, propertyUuid, valueUuid }) => ({
        id: `${attachment.fileName}-${Date.now()}`, // Unique task ID
        attachment,
        objectUuid,
        propertyUuid,
        valueUuid,
        status: 'pending',
        progress: 0,
        retries: 0,
      }))

    logger.info(`Queueing ${tasks.length} file uploads with context:`, tasks)

    this.uploadQueue.push(...tasks)
    await this.processQueue()
  }

  /**
   * Legacy method - Queue file uploads with single context for all files
   */
  async queueFileUploads(
    attachments: Attachment[],
    context: {
      objectUuid?: string
      propertyUuid?: string
      valueUuid?: string
    }
  ): Promise<void> {
    const tasks: FileUploadTask[] = attachments
      .filter((attachment) => {
        // Include upload files with blobs OR reference files with URLs
        return (
          (attachment.mode === 'upload' && attachment.blob) ||
          (attachment.mode === 'reference' &&
            (attachment.fileReference || attachment.url))
        )
      })
      .map((attachment) => ({
        id: `${attachment.fileName}-${Date.now()}`, // Unique task ID
        attachment,
        ...context,
        status: 'pending',
        progress: 0,
        retries: 0,
      }))

    logger.info(`Queueing ${tasks.length} file uploads:`, tasks)

    this.uploadQueue.push(...tasks)
    await this.processQueue()
  }

  /**
   * Process the upload queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      const pendingTasks = this.uploadQueue.filter(
        (t) => t.status === 'pending'
      )

      // Process in batches
      for (
        let i = 0;
        i < pendingTasks.length;
        i += this.options.maxConcurrent
      ) {
        const batch = pendingTasks.slice(i, i + this.options.maxConcurrent)
        await Promise.allSettled(batch.map((task) => this.processTask(task)))
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Process a single upload task - New simplified flow using uploadDirect
   */
  private async processTask(task: FileUploadTask): Promise<void> {
    try {
      task.status = 'uploading'
      this.options.onProgress(task.id, 0)

      logger.info(`Processing file ${task.attachment.fileName}`)

      // Validate based on attachment mode
      if (task.attachment.mode === 'upload' && !task.attachment.blob) {
        throw new Error('No blob data available for upload')
      }
      if (
        task.attachment.mode === 'reference' &&
        !task.attachment.fileReference &&
        !task.attachment.url
      ) {
        throw new Error('No file reference URL available for reference upload')
      }

      // Determine the UUID to attach to (priority: valueUuid > propertyUuid > objectUuid)
      const uuidToAttach =
        task.valueUuid || task.propertyUuid || task.objectUuid
      if (!uuidToAttach) {
        throw new Error('No UUID provided to attach file to')
      }

      this.options.onProgress(task.id, 50)

      let response
      if (task.attachment.mode === 'reference') {
        // Use uploadByReference for external file references
        const fileReference =
          task.attachment.fileReference || task.attachment.url
        if (!fileReference) {
          throw new Error(
            'File reference URL is required for reference uploads'
          )
        }

        const uploadData: any = {
          fileName: task.attachment.fileName,
          fileReference: fileReference,
          uuidToAttach: uuidToAttach,
        }
        if (task.attachment.label) {
          uploadData.label = task.attachment.label
        }

        response = await this.client.files.uploadByReference(uploadData)
      } else {
        // Use the new uploadDirect method for file uploads
        // Pass the raw blob/file directly - library handles FormData creation
        if (!task.attachment.blob) {
          throw new Error('Blob is required for direct uploads')
        }

        response = await this.client.files.uploadDirect({
          file: task.attachment.blob,
          uuidToAttach: uuidToAttach,
        })
      }

      this.options.onProgress(task.id, 100)

      task.status = 'completed'
      this.options.onComplete(task.id)
    } catch (error: any) {
      task.retries++
      task.error = error.message

      logger.error(`Upload failed for ${task.attachment.fileName}:`, {
        error: error.message,
      })

      if (task.retries < this.options.maxRetries) {
        task.status = 'pending'
        // Retry after delay
        setTimeout(() => this.processQueue(), 1000 * task.retries)
      } else {
        task.status = 'failed'
        this.options.onError(task.id, error.message)
      }
    }
  }

  /**
   * Get upload progress summary
   */
  getProgress(): {
    completed: number
    failed: number
    pending: number
    total: number
  } {
    const completed = this.uploadQueue.filter(
      (t) => t.status === 'completed'
    ).length
    const failed = this.uploadQueue.filter((t) => t.status === 'failed').length
    const pending = this.uploadQueue.filter(
      (t) => t.status === 'pending' || t.status === 'uploading'
    ).length

    return {
      completed,
      failed,
      pending,
      total: this.uploadQueue.length,
    }
  }

  /**
   * Clear completed tasks from queue
   */
  clearCompleted(): void {
    this.uploadQueue = this.uploadQueue.filter((t) => t.status !== 'completed')
  }

  /**
   * Get current upload status for reporting
   */
  getUploadSummary(): {
    completed: FileUploadTask[]
    failed: FileUploadTask[]
    pending: FileUploadTask[]
    isProcessing: boolean
  } {
    return {
      completed: this.uploadQueue.filter((t) => t.status === 'completed'),
      failed: this.uploadQueue.filter((t) => t.status === 'failed'),
      pending: this.uploadQueue.filter(
        (t) => t.status === 'pending' || t.status === 'uploading'
      ),
      isProcessing: this.processing,
    }
  }

  /**
   * Wait for all current uploads to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkStatus = () => {
        const { pending, isProcessing } = this.getUploadSummary()
        if (pending.length === 0 && !isProcessing) {
          resolve()
        } else {
          setTimeout(checkStatus, 500)
        }
      }
      checkStatus()
    })
  }
}

// Global service instance
let uploadService: FileUploadService | null = null

export function getUploadService(client: ApiClient): FileUploadService {
  if (!uploadService) {
    uploadService = new FileUploadService(client, {
      onProgress: (taskId, progress) => {
        // Could emit events here for UI updates
      },
      onComplete: () => {},
      onError: (taskId, error: string) => {
        // Individual file error - we'll handle summary in the calling code
        logger.error(`File ${taskId} upload failed:`, { error: error })
      },
    })
  }
  return uploadService
}
