'use client'

import type { Client } from 'iom-sdk'
import type { Attachment } from '@/types'
import { useIomSdkClient } from '@/contexts'
import { logger } from './logger'

type ApiClient = Client

export interface FileUploadTask {
  id: string
  attachment: Attachment
  // Context for creating relationships
  objectUuid?: string
  propertyUuid?: string
  valueUuid?: string
  status: 'pending' | 'uploading' | 'cancelling' | 'completed' | 'failed'
  progress: number
  retries: number
  error?: string
  // Created at enqueue (not at upload start) so cancelTask can always abort,
  // including during the SHA-256 hash phase before init returns.
  abortController?: AbortController
}

export interface FileUploadOptions {
  maxRetries?: number
  maxConcurrent?: number
  onProgress?: (taskId: string, progress: number) => void
  onComplete?: (taskId: string) => void
  onError?: (taskId: string, error: string) => void
}

// If a task is told to cancel but the abort never propagates out of the SDK
// (network stall, server hang), force it to 'failed' after this many ms.
const CANCELLING_WATCHDOG_MS = 10_000

export class FileUploadService {
  private client: ApiClient
  private uploadQueue: FileUploadTask[] = []
  private allTasks: FileUploadTask[] = []
  private listeners = new Set<() => void>()
  private inFlight = new Set<Promise<void>>()
  private options: Required<FileUploadOptions>
  // Resolvers for addFile() promises. Drained the moment a task reaches a
  // terminal state (completed | failed), and always after notify() so
  // subscribers observe the final state before awaiters resume.
  private waiters = new Map<string, () => void>()
  // Active 'cancelling' watchdog timers, keyed by task id.
  private cancellingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

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

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  // Resolves the awaiter for a task. Must be called AFTER notify() so any
  // code awaiting addFile()/queueFileUploadsWithContext() observes the
  // already-rendered final state.
  private settle(id: string) {
    const resolve = this.waiters.get(id)
    if (resolve) {
      this.waiters.delete(id)
      resolve()
    }
    const timer = this.cancellingTimeouts.get(id)
    if (timer) {
      clearTimeout(timer)
      this.cancellingTimeouts.delete(id)
    }
  }

  getAllTasks(): FileUploadTask[] {
    return this.allTasks.slice()
  }

  /**
   * Enqueue a file. Returns a promise that resolves once the task reaches a
   * terminal state (completed or failed/cancelled). The promise never rejects
   * — failures surface via task.status / task.error and the onError callback.
   */
  addFile(task: FileUploadTask): Promise<void> {
    // Pre-create the abort signal so cancelTask works during the hash phase.
    if (!task.abortController) {
      task.abortController = new AbortController()
    }
    const promise = new Promise<void>((resolve) => {
      this.waiters.set(task.id, resolve)
    })
    this.uploadQueue.push(task)
    this.allTasks.push(task)
    this.notify()
    this.schedule()
    return promise
  }

  /**
   * Event-driven scheduler. Called from `addFile` (new task arriving) and
   * from the `.finally` of each in-flight upload (slot freed). Reads
   * `maxConcurrent` fresh on every invocation so mid-flight config changes
   * take effect immediately.
   */
  private schedule() {
    const concurrent = Math.max(1, this.options.maxConcurrent)
    while (this.uploadQueue.length > 0 && this.inFlight.size < concurrent) {
      const task = this.uploadQueue.shift()
      if (!task) break
      const p: Promise<void> = this.uploadFile(task)
        .then(() => undefined)
        .catch((error: any) => {
          logger.error(`File upload failed for task ${task.id}:`, error)
          const message: string = error?.message ?? 'Upload failed'
          task.status = 'failed'
          task.error = message
          task.abortController = undefined
          this.notify()
          this.options.onError(task.id, message)
          this.settle(task.id)
        })
        .finally(() => {
          this.inFlight.delete(p)
          // Slot freed — see if more queued work is waiting.
          this.schedule()
        })
      this.inFlight.add(p)
    }
  }

  private async uploadFile(task: FileUploadTask) {
    if (!this.client?.fileStorage) {
      throw new Error('SDK client fileStorage service not available')
    }

    // AbortController was pre-created in addFile(); reuse it.
    const abortController = task.abortController ?? new AbortController()
    task.abortController = abortController
    // If cancelTask already fired before we got a slot, short-circuit.
    if (abortController.signal.aborted) {
      task.status = 'failed'
      task.error = 'Cancelled'
      task.abortController = undefined
      this.notify()
      this.options.onError(task.id, 'Cancelled')
      this.settle(task.id)
      return
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

    try {
      let response
      if (task.attachment.mode === 'reference') {
        const fileReference =
          task.attachment.fileReference || task.attachment.url
        if (!fileReference) {
          throw new Error(
            'File reference URL is required for reference uploads'
          )
        }

        response = await this.client.node.uploadFileByReference({
          fileName: task.attachment.fileName || '',
          fileReference,
          uuidToAttach,
          contentType: task.attachment.mimeType,
          size: task.attachment.size,
          label: task.attachment.label,
        })
        this.options.onProgress(task.id, 100)
      } else {
        if (!task.attachment.blob) {
          throw new Error('Blob is required for direct uploads')
        }

        const stored = await this.client.fileStorage.uploadFile({
          file: task.attachment.blob as File,
          fileName: task.attachment.fileName,
          contentType: task.attachment.mimeType,
          signal: abortController.signal,
          onProgress: (loaded: number, total: number) => {
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
            task.progress = pct
            this.notify()
            this.options.onProgress(task.id, pct)
          },
        })
        response = await this.client.node.uploadFileByReference({
          fileName: stored.fileName,
          fileReference: stored.fileReference,
          uuidToAttach,
          contentType: stored.mimeType,
          size: stored.size,
          label: task.attachment.label,
        })
      }

      // Commit all fields, then notify, then settle.
      task.progress = 100
      task.abortController = undefined
      task.status = 'completed'
      this.notify()
      this.options.onComplete(task.id)
      this.settle(task.id)
      return response
    } catch (err) {
      task.abortController = undefined
      if (isAbortError(err)) {
        task.error = 'Cancelled'
        task.status = 'failed'
        this.notify()
        this.options.onError(task.id, 'Cancelled')
        this.settle(task.id)
        return
      }
      throw err
    }
  }

  /**
   * Cancel a task in any pre-terminal state. After A1 the abort signal exists
   * from the moment addFile() is called, so this works during hashing, multi-
   * part init, and individual part uploads alike.
   */
  cancelTask(id: string) {
    const task = this.allTasks.find((t) => t.id === id)
    if (!task) return
    if (task.status === 'completed' || task.status === 'failed') return

    // Always abort the signal — the SDK uses it to skip pending work and to
    // fire DELETE /api/FileStorage/{uploadId} when an init has already run.
    task.abortController?.abort()

    if (task.status === 'pending') {
      // Task never started: remove from queue and mark failed synchronously.
      this.uploadQueue = this.uploadQueue.filter((t) => t.id !== id)
      task.error = 'Cancelled'
      task.abortController = undefined
      task.status = 'failed'
      this.notify()
      this.options.onError(id, 'Cancelled')
      this.settle(id)
      return
    }

    // 'uploading' or already 'cancelling' — show cancelling spinner and let
    // uploadFile's catch transition to 'failed'. Watchdog forces the
    // transition if the SDK never resolves.
    if (task.status !== 'cancelling') {
      task.status = 'cancelling'
      this.notify()
    }
    if (!this.cancellingTimeouts.has(id)) {
      const timer = setTimeout(() => {
        this.cancellingTimeouts.delete(id)
        const t = this.allTasks.find((x) => x.id === id)
        if (!t || t.status !== 'cancelling') return
        t.error = 'Cancelled'
        t.abortController = undefined
        t.status = 'failed'
        this.notify()
        this.options.onError(id, 'Cancelled')
        this.settle(id)
      }, CANCELLING_WATCHDOG_MS)
      this.cancellingTimeouts.set(id, timer)
    }
  }

  /**
   * Re-enqueue a failed task. Mutates in place under the same id so React
   * keys stay unique. Guards against rapid double-clicks: a second call
   * while the task is already re-queued is a no-op.
   */
  retryTask(id: string) {
    const task = this.allTasks.find((t) => t.id === id)
    if (!task || task.status !== 'failed') return
    if (this.uploadQueue.includes(task)) return

    task.status = 'pending'
    task.progress = 0
    task.error = undefined
    task.retries += 1
    task.abortController = new AbortController()
    const promise = new Promise<void>((resolve) => {
      this.waiters.set(task.id, resolve)
    })
    // Promise is intentionally discarded — retryTask callers observe via
    // subscribe, not via await. We just need the waiter installed so a
    // future await on this id would work.
    void promise
    this.uploadQueue.push(task)
    this.notify()
    this.schedule()
  }

  getQueueStatus() {
    return this.allTasks.map((task) => ({
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error,
    }))
  }

  /**
   * Queue file uploads with context. Concurrent-safe: each call awaits only
   * its own task settlements via addFile()'s returned promise.
   */
  async queueFileUploadsWithContext(fileContexts: any[]): Promise<void> {
    if (fileContexts.length === 0) return
    const promises = fileContexts.map((context) => {
      const id = `upload-${Date.now()}-${Math.random()}`
      return this.addFile({
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
    await Promise.all(promises)
  }

  getUploadSummary() {
    const completed = this.allTasks.filter((t) => t.status === 'completed')
    const failed = this.allTasks.filter((t) => t.status === 'failed')
    const pending = this.allTasks.filter((t) => t.status === 'pending')
    const uploading = this.allTasks.filter((t) => t.status === 'uploading')

    return {
      completed,
      failed,
      pending,
      uploading,
      total: this.allTasks.length,
    }
  }

  /**
   * Drop completed (and orphaned 'cancelling') tasks. Failed tasks are kept
   * so the user can retry.
   */
  clearCompleted() {
    const drop = (t: FileUploadTask) =>
      t.status === 'completed' || t.status === 'cancelling'
    this.uploadQueue = this.uploadQueue.filter((t) => !drop(t))
    for (const t of this.allTasks) {
      if (drop(t)) this.settle(t.id)
    }
    this.allTasks = this.allTasks.filter((t) => !drop(t))
    this.notify()
  }
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const kind = (err as { kind?: unknown }).kind
  if (kind === 'Aborted') return true
  const name = (err as { name?: unknown }).name
  return name === 'AbortError'
}

// Module-level singleton keyed on the SDK client AND its current token, so a
// re-auth that reuses the client instance still rebuilds the service (and
// drops any in-flight queue state tied to the old session).
let singletonClient: ApiClient | null = null
let singletonToken: string | null = null
let singletonService: FileUploadService | null = null

export function useUploadService(): FileUploadService {
  const client = useIomSdkClient()
  const token =
    typeof (client as any)?.getToken === 'function'
      ? ((client as any).getToken() as string | null)
      : null

  if (
    !singletonService ||
    singletonClient !== client ||
    singletonToken !== token
  ) {
    singletonService = new FileUploadService(client)
    singletonClient = client
    singletonToken = token
  }

  return singletonService
}

export function getUploadService() {
  throw new Error(
    'getUploadService() is deprecated. Use useUploadService() hook instead.'
  )
}
