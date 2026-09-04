'use client'

import type { FileTarget, Io2pClient, UploadInput } from 'io2p-client'

import { logger } from './observability/logger'

/**
 * The background upload queue, on io2p.
 *
 * Uploads outlive the sheet that started them, so this owns the work rather than any component: a
 * user can save an object, close it, and keep browsing while bytes go up.
 *
 * The semantics here are ported from the old `upload-service` and are NOT incidental — each one was
 * earned by a real failure. Keep them:
 *   - the abort signal exists from ENQUEUE, not from upload start, so cancel works while a file is
 *     still queued or hashing;
 *   - a `cancelling` task that never resolves is forced to `failed` by a watchdog, so a network
 *     stall can't leave a permanent spinner;
 *   - the scheduler is event-driven (on enqueue and on each slot freeing) and re-reads the cap every
 *     time, so a runtime change takes effect immediately;
 *   - the singleton is keyed on the client AND the user id — NOT the JWT, which rotates on refresh
 *     and would rebuild the queue mid-upload, orphaning in-flight tasks (the widget froze at 0%).
 *
 * Deliberately absent: `files.abort()` as cleanup. After a failed `complete` the file is
 * ready-but-unattached and abort 422s it; the SDK re-completes on its own. Cancellation is the
 * AbortController, and that is the only thing that should stop an upload.
 */

export type UploadTaskStatus =
  | 'pending'
  | 'uploading'
  | 'cancelling'
  | 'completed'
  | 'failed'

export interface UploadTask {
  id: string
  fileName: string
  size: number
  contentType?: string
  file: UploadInput
  target: FileTarget
  status: UploadTaskStatus
  /** 0–100. Byte-level in the browser (the SDK uses XHR), so this animates rather than snapping. */
  progress: number
  retries: number
  error?: string
  abortController?: AbortController
}

export interface UploadQueueOptions {
  maxConcurrent?: number
  onSettled?: (task: UploadTask) => void
}

/** Force a stuck `cancelling` task to `failed` after this long. */
const CANCELLING_WATCHDOG_MS = 10_000
const CANCELLED = 'Cancelled'

export class UploadQueue {
  private queued: UploadTask[] = []
  private tasks: UploadTask[] = []
  private snapshot: UploadTask[] = []
  private listeners = new Set<() => void>()
  private inFlight = new Set<Promise<void>>()
  private watchdogs = new Map<string, ReturnType<typeof setTimeout>>()
  private maxConcurrent: number
  private onSettled: (task: UploadTask) => void

  constructor(
    private client: Io2pClient,
    options: UploadQueueOptions = {}
  ) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 3)
    this.onSettled = options.onSettled ?? (() => {})
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * A snapshot with a STABLE identity between notifications. `useSyncExternalStore`
   * re-renders whenever the snapshot's reference changes, so returning a fresh
   * `slice()` on every call would loop forever. `notify()` recomputes it exactly
   * when the task list actually changed.
   */
  getTasks(): UploadTask[] {
    return this.snapshot
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, n)
    this.schedule()
  }

  enqueue(
    input: Omit<
      UploadTask,
      'status' | 'progress' | 'retries' | 'abortController'
    >
  ): void {
    this.tasks.push({
      ...input,
      status: 'pending',
      progress: 0,
      retries: 0,
      // Pre-created so cancel works before the task ever gets a slot.
      abortController: new AbortController(),
    })
    this.notify()
    this.schedule()
  }

  cancel(id: string): void {
    const task = this.find(id)
    if (!task || this.isTerminal(task)) return

    task.abortController?.abort()

    if (task.status === 'pending') {
      // Never started, so there's nothing to wait for — fail it synchronously.
      this.queued = this.queued.filter((t) => t.id !== id)
      return this.fail(task, CANCELLED)
    }

    if (task.status !== 'cancelling') {
      task.status = 'cancelling'
      this.notify()
    }
    if (!this.watchdogs.has(id)) {
      this.watchdogs.set(
        id,
        setTimeout(() => {
          this.watchdogs.delete(id)
          const t = this.find(id)
          if (t?.status === 'cancelling') this.fail(t, CANCELLED)
        }, CANCELLING_WATCHDOG_MS)
      )
    }
  }

  /** Re-queue a failed task in place, so its React key stays stable. */
  retry(id: string): void {
    const task = this.find(id)
    if (!task || task.status !== 'failed') return
    if (this.queued.includes(task)) return // guard a double click

    task.status = 'pending'
    task.progress = 0
    task.error = undefined
    task.retries += 1
    task.abortController = new AbortController()
    this.queued.push(task)
    this.notify()
    this.schedule()
  }

  /** Drop one finished task. In-flight tasks must be cancelled first. */
  remove(id: string): void {
    const task = this.find(id)
    if (!task || !this.isTerminal(task)) return
    this.queued = this.queued.filter((t) => t.id !== id)
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.notify()
  }

  /** Drop completed tasks, keeping failures so they stay retryable. */
  clearCompleted(): void {
    this.queued = this.queued.filter((t) => t.status !== 'completed')
    this.tasks = this.tasks.filter((t) => t.status !== 'completed')
    this.notify()
  }

  private find(id: string) {
    return this.tasks.find((t) => t.id === id)
  }

  private isTerminal(task: UploadTask) {
    return task.status === 'completed' || task.status === 'failed'
  }

  private notify() {
    this.snapshot = this.tasks.slice()
    this.listeners.forEach((l) => l())
  }

  private fail(task: UploadTask, message: string) {
    this.clearWatchdog(task.id)
    task.status = 'failed'
    task.error = message
    task.abortController = undefined
    this.notify()
    this.onSettled(task)
  }

  private clearWatchdog(id: string) {
    const timer = this.watchdogs.get(id)
    if (timer) {
      clearTimeout(timer)
      this.watchdogs.delete(id)
    }
  }

  /**
   * Event-driven: runs on enqueue and again as each slot frees. Reads the cap fresh every time so a
   * runtime change applies immediately rather than at the next natural turnover.
   */
  private schedule(): void {
    // Anything pending that isn't already queued (a fresh enqueue) belongs in the queue.
    for (const task of this.tasks) {
      if (task.status === 'pending' && !this.queued.includes(task)) {
        this.queued.push(task)
      }
    }

    while (this.queued.length > 0 && this.inFlight.size < this.maxConcurrent) {
      const task = this.queued.shift()
      if (!task) break
      const run: Promise<void> = this.run(task)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          logger.warn('Upload failed', { taskId: task.id, error: message })
          this.fail(task, message)
        })
        .finally(() => {
          this.inFlight.delete(run)
          this.schedule()
        })
      this.inFlight.add(run)
    }
  }

  private async run(task: UploadTask): Promise<void> {
    const signal = task.abortController?.signal
    if (signal?.aborted) return this.fail(task, CANCELLED)

    task.status = 'uploading'
    task.progress = 0
    this.notify()

    try {
      await this.client.files.upload(task.file, task.target, {
        signal,
        onProgress: ({ loaded, total }) => {
          task.progress = total > 0 ? Math.round((loaded / total) * 100) : 0
          this.notify()
        },
      })
      this.clearWatchdog(task.id)
      task.progress = 100
      task.status = 'completed'
      task.abortController = undefined
      this.notify()
      this.onSettled(task)
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        return this.fail(task, CANCELLED)
      }
      throw error
    }
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, kind } = error as { name?: unknown; kind?: unknown }
  return name === 'AbortError' || kind === 'Aborted'
}
