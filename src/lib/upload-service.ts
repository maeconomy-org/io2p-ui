'use client'

import type { Client } from 'iom-sdk'
import type { Attachment } from '@/types'
import { useIomSdkClient } from '@/contexts'
import { logger } from './logger'

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
  // Queue: tasks still to be processed. Tasks are shifted out as processQueue
  // picks them up, so this shrinks over time.
  private uploadQueue: FileUploadTask[] = []
  // Persistent history: every task ever enqueued, in insertion order. Tasks
  // mutate in place (status, progress, error), so subscribers see live updates
  // without us re-pushing. Used by the UploadCenter widget.
  private allTasks: FileUploadTask[] = []
  private listeners = new Set<() => void>()
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
   * Subscribe to queue state changes. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  /**
   * Get the full task history (pending, uploading, completed, failed).
   */
  getAllTasks(): FileUploadTask[] {
    return this.allTasks.slice()
  }

  /**
   * Add a file to the upload queue
   */
  addFile(task: FileUploadTask) {
    this.uploadQueue.push(task)
    this.allTasks.push(task)
    this.notify()
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
        this.notify()
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
    this.notify()
    this.options.onProgress(task.id, 0)

    // Prefer more specific UUIDs: value > property > object
    const uuidToAttach = task.valueUuid || task.propertyUuid || task.objectUuid

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
    task.progress = 100
    this.notify()
    this.options.onComplete(task.id)
    return response
  }

  /**
   * Get the current queue status (full history, including terminal tasks).
   */
  getQueueStatus() {
    return this.allTasks.map((task) => ({
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
    // Track each queued task's terminal state via a per-id promise so callers
    // can reliably invalidate caches once uploads finish.
    const pendingIds = new Set<string>()
    let resolveAll: () => void
    const allDone = new Promise<void>((r) => {
      resolveAll = r
    })

    const prevOnComplete = this.options.onComplete
    const prevOnError = this.options.onError
    const markDone = (id: string) => {
      if (pendingIds.delete(id) && pendingIds.size === 0) {
        this.options.onComplete = prevOnComplete
        this.options.onError = prevOnError
        resolveAll()
      }
    }
    this.options.onComplete = (id: string) => {
      prevOnComplete(id)
      markDone(id)
    }
    this.options.onError = (id: string, err: string) => {
      prevOnError(id, err)
      markDone(id)
    }

    fileContexts.forEach((context) => {
      const id = `upload-${Date.now()}-${Math.random()}`
      pendingIds.add(id)
      this.addFile({
        id,
        attachment: context.attachment,
        objectUuid: context.objectUuid,
        propertyUuid: context.propertyUuid,
        valueUuid: context.valueUuid,
        status: 'pending',
        progress: 0,
        retries: 0,
      })
    })

    if (pendingIds.size === 0) {
      this.options.onComplete = prevOnComplete
      this.options.onError = prevOnError
      resolveAll!()
    }

    return allDone
  }

  /**
   * Get upload summary across the full task history (not just the pending
   * queue), so callers can see completed/failed counts after processQueue
   * has shifted tasks out.
   */
  getUploadSummary() {
    const completed = this.allTasks.filter(
      (task) => task.status === 'completed'
    )
    const failed = this.allTasks.filter((task) => task.status === 'failed')
    const pending = this.allTasks.filter((task) => task.status === 'pending')
    const uploading = this.allTasks.filter(
      (task) => task.status === 'uploading'
    )

    return {
      completed,
      failed,
      pending,
      uploading,
      total: this.allTasks.length,
    }
  }

  /**
   * Clear completed uploads from the history. Failed uploads are kept so the
   * user can retry them.
   */
  clearCompleted() {
    this.uploadQueue = this.uploadQueue.filter(
      (task) => task.status !== 'completed'
    )
    this.allTasks = this.allTasks.filter((task) => task.status !== 'completed')
    this.notify()
  }
}

// Module-level singleton so every component sees the same queue. The instance
// is keyed by the SDK client so it's recreated if the client changes (e.g.
// after re-auth). Previously this returned a fresh FileUploadService on every
// render, which meant the Files tab and the Add sheet each had their own
// (invisible) queue.
let singletonClient: ApiClient | null = null
let singletonService: FileUploadService | null = null

export function useUploadService(): FileUploadService {
  const client = useIomSdkClient()

  if (!singletonService || singletonClient !== client) {
    singletonService = new FileUploadService(client)
    singletonClient = client
  }

  return singletonService
}

// Legacy function for non-React contexts (will be phased out)
export function getUploadService() {
  // This is a fallback for components that haven't been updated yet
  // We'll gradually replace all usages with the hook
  throw new Error(
    'getUploadService() is deprecated. Use useUploadService() hook instead.'
  )
}
