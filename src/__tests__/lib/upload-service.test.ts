import { describe, it, expect, vi, beforeEach } from 'vitest'

import { FileUploadService, type FileUploadTask } from '@/lib/upload-service'
import type { Attachment } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────

interface Deferred<T = unknown> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeClient(overrides?: {
  uploadFile?: ReturnType<typeof vi.fn>
  uploadFileByReference?: ReturnType<typeof vi.fn>
}) {
  return {
    node: {
      uploadFileByReference:
        overrides?.uploadFileByReference ??
        vi.fn().mockResolvedValue({ ok: true }),
    },
    fileStorage: {
      uploadFile:
        overrides?.uploadFile ?? vi.fn().mockResolvedValue({ ok: true }),
    },
  } as any
}

function makeTask(overrides: Partial<FileUploadTask> = {}): FileUploadTask {
  const attachment: Attachment = {
    mode: 'upload',
    fileName: 'doc.pdf',
    blob: new Blob(['hello'], { type: 'application/pdf' }) as any,
  } as any

  return {
    id: overrides.id ?? `task-${Math.random()}`,
    attachment,
    objectUuid: 'obj-1',
    status: 'pending',
    progress: 0,
    retries: 0,
    ...overrides,
  }
}

// Wait for all microtasks/queued promises to settle.
async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('FileUploadService', () => {
  let service: FileUploadService
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    client = makeClient()
    service = new FileUploadService(client)
  })

  describe('construction', () => {
    it('throws when client is missing', () => {
      expect(() => new FileUploadService(null as any)).toThrow(
        /API client is required/
      )
    })
  })

  describe('addFile + notify', () => {
    it('pushes task into both queue and allTasks and notifies subscribers', async () => {
      const listener = vi.fn()
      service.subscribe(listener)

      service.addFile(makeTask({ id: 'a' }))
      await flush()

      expect(service.getAllTasks().map((t) => t.id)).toContain('a')
      // Notifications fire on every status change: enqueue, uploading, completed.
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('subscribe / unsubscribe', () => {
    it('unsubscribe stops further notifications', async () => {
      const listener = vi.fn()
      const unsub = service.subscribe(listener)
      unsub()

      service.addFile(makeTask())
      await flush()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('processQueue — parallel + concurrency cap', () => {
    it('drains tasks in parallel up to maxConcurrent', async () => {
      const d1 = deferred<{ ok: true }>()
      const d2 = deferred<{ ok: true }>()

      const uploadFile = vi
        .fn()
        .mockImplementationOnce(() => d1.promise)
        .mockImplementationOnce(() => d2.promise)

      // Default maxConcurrent = 3 → both tasks should run at once.
      service = new FileUploadService(makeClient({ uploadFile }))

      service.addFile(makeTask({ id: 'first' }))
      service.addFile(makeTask({ id: 'second' }))
      await flush()

      const tasks = service.getAllTasks()
      expect(tasks.find((t) => t.id === 'first')!.status).toBe('uploading')
      expect(tasks.find((t) => t.id === 'second')!.status).toBe('uploading')

      d1.resolve({ ok: true })
      d2.resolve({ ok: true })
      await flush()

      expect(service.getUploadSummary().completed).toHaveLength(2)
    })

    it('respects maxConcurrent=1 (sequential)', async () => {
      const d1 = deferred<{ ok: true }>()
      const d2 = deferred<{ ok: true }>()
      const uploadFile = vi
        .fn()
        .mockImplementationOnce(() => d1.promise)
        .mockImplementationOnce(() => d2.promise)

      service = new FileUploadService(makeClient({ uploadFile }), {
        maxConcurrent: 1,
      })

      service.addFile(makeTask({ id: 'first' }))
      service.addFile(makeTask({ id: 'second' }))
      await flush()

      expect(service.getAllTasks().find((t) => t.id === 'first')!.status).toBe(
        'uploading'
      )
      expect(service.getAllTasks().find((t) => t.id === 'second')!.status).toBe(
        'pending'
      )

      d1.resolve({ ok: true })
      await flush()

      expect(service.getAllTasks().find((t) => t.id === 'second')!.status).toBe(
        'uploading'
      )
      d2.resolve({ ok: true })
      await flush()
    })
  })

  describe('uploadFile transitions', () => {
    it('success: pending → uploading → completed with progress 100', async () => {
      const listener = vi.fn()
      service.subscribe(listener)

      service.addFile(makeTask({ id: 'ok' }))
      await flush()

      const task = service.getAllTasks().find((t) => t.id === 'ok')!
      expect(task.status).toBe('completed')
      expect(task.progress).toBe(100)
      expect(listener).toHaveBeenCalled()
    })

    it('failure: sets status=failed with error message and still notifies', async () => {
      client = makeClient({
        uploadFile: vi.fn().mockRejectedValue(new Error('boom')),
      })
      service = new FileUploadService(client)

      const listener = vi.fn()
      service.subscribe(listener)

      service.addFile(makeTask({ id: 'bad' }))
      await flush()

      const task = service.getAllTasks().find((t) => t.id === 'bad')!
      expect(task.status).toBe('failed')
      expect(task.error).toBe('boom')
      expect(listener).toHaveBeenCalled()
    })

    it('uses uploadFileByReference when attachment mode is reference', async () => {
      const uploadFileByReference = vi.fn().mockResolvedValue({ ok: true })
      const uploadFile = vi.fn()
      service = new FileUploadService(
        makeClient({ uploadFileByReference, uploadFile })
      )

      service.addFile(
        makeTask({
          id: 'ref',
          attachment: {
            mode: 'reference',
            fileName: 'external.pdf',
            fileReference: 'https://example.com/external.pdf',
          } as any,
        })
      )
      await flush()

      expect(uploadFileByReference).toHaveBeenCalledOnce()
      expect(uploadFile).not.toHaveBeenCalled()
    })

    it('fails when no UUID is provided to attach to', async () => {
      service.addFile(
        makeTask({
          id: 'no-uuid',
          objectUuid: undefined,
          propertyUuid: undefined,
          valueUuid: undefined,
        })
      )
      await flush()

      const task = service.getAllTasks().find((t) => t.id === 'no-uuid')!
      expect(task.status).toBe('failed')
      expect(task.error).toMatch(/No UUID/)
    })
  })

  describe('getQueueStatus / getUploadSummary', () => {
    it('reads from allTasks history, including completed tasks', async () => {
      service.addFile(makeTask({ id: 't1' }))
      await flush()

      const status = service.getQueueStatus()
      expect(status).toHaveLength(1)
      expect(status[0]).toMatchObject({ id: 't1', status: 'completed' })

      const summary = service.getUploadSummary()
      expect(summary.total).toBe(1)
      expect(summary.completed).toHaveLength(1)
    })
  })

  describe('clearCompleted', () => {
    it('removes completed tasks from both arrays and notifies', async () => {
      service.addFile(makeTask({ id: 't1' }))
      await flush()

      const listener = vi.fn()
      service.subscribe(listener)

      service.clearCompleted()

      expect(service.getAllTasks()).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })

    it('keeps failed tasks so the user can retry', async () => {
      client = makeClient({
        uploadFile: vi.fn().mockRejectedValue(new Error('nope')),
      })
      service = new FileUploadService(client)

      service.addFile(makeTask({ id: 'bad' }))
      await flush()

      service.clearCompleted()

      expect(service.getAllTasks().map((t) => t.id)).toEqual(['bad'])
    })
  })

  describe('removeTask', () => {
    it('removes a completed task and notifies', async () => {
      service.addFile(makeTask({ id: 'a' }))
      service.addFile(makeTask({ id: 'b' }))
      await flush()

      const listener = vi.fn()
      service.subscribe(listener)
      listener.mockClear()

      service.removeTask('a')

      expect(service.getAllTasks().map((t) => t.id)).toEqual(['b'])
      expect(listener).toHaveBeenCalled()
    })

    it('removes a failed task so the row can be dismissed after retry abandons', async () => {
      service = new FileUploadService(
        makeClient({
          uploadFile: vi.fn().mockRejectedValue(new Error('nope')),
        })
      )
      service.addFile(makeTask({ id: 'bad' }))
      await flush()

      service.removeTask('bad')

      expect(service.getAllTasks()).toHaveLength(0)
    })

    it('is a no-op for in-flight tasks (cancel is the contract for those)', async () => {
      // Hang the upload so the task stays in `uploading`.
      const hang = deferred<{ ok: true }>()
      service = new FileUploadService(
        makeClient({ uploadFile: vi.fn().mockReturnValue(hang.promise) })
      )
      service.addFile(makeTask({ id: 'live' }))
      await flush()

      service.removeTask('live')

      // Still present, status untouched.
      const task = service.getAllTasks().find((t) => t.id === 'live')!
      expect(task).toBeDefined()
      expect(task.status).toBe('uploading')

      hang.resolve({ ok: true })
      await flush()
    })

    it('is a no-op for unknown ids', () => {
      // No throw; no notification.
      const listener = vi.fn()
      service.subscribe(listener)
      listener.mockClear()

      service.removeTask('does-not-exist')

      expect(listener).not.toHaveBeenCalled()
    })

    it('settles the addFile awaiter so callers do not hang', async () => {
      const done = service.addFile(makeTask({ id: 'p' }))
      await flush()
      // Task is completed at this point; awaiter already resolved. The
      // contract we care about: removing it after settlement does not
      // re-trigger or break the awaiter.
      service.removeTask('p')
      await expect(done).resolves.toBeUndefined()
    })
  })

  describe('queueFileUploadsWithContext', () => {
    it('resolves after every queued task reaches a terminal state', async () => {
      const done = service.queueFileUploadsWithContext([
        { attachment: makeTask().attachment, objectUuid: 'obj-1' },
        { attachment: makeTask().attachment, objectUuid: 'obj-1' },
      ])

      await expect(done).resolves.toBeUndefined()
      expect(service.getUploadSummary().completed).toHaveLength(2)
    })

    it('resolves immediately when given no contexts', async () => {
      await expect(
        service.queueFileUploadsWithContext([])
      ).resolves.toBeUndefined()
    })

    it('resolves even when uploads fail', async () => {
      client = makeClient({
        uploadFile: vi.fn().mockRejectedValue(new Error('x')),
      })
      service = new FileUploadService(client)

      await expect(
        service.queueFileUploadsWithContext([
          { attachment: makeTask().attachment, objectUuid: 'obj-1' },
        ])
      ).resolves.toBeUndefined()
      expect(service.getUploadSummary().failed).toHaveLength(1)
    })
  })

  describe('cancelTask', () => {
    it('removes a still-pending task from the queue without ever uploading', async () => {
      // First task hangs forever; second sits in the queue behind it.
      // maxConcurrent=1 so the second task can't sneak past while the first
      // is hanging.
      const hang = deferred<{ ok: true }>()
      const uploadFile = vi
        .fn()
        .mockImplementationOnce(() => hang.promise)
        .mockResolvedValue({ ok: true })
      service = new FileUploadService(makeClient({ uploadFile }), {
        maxConcurrent: 1,
      })

      service.addFile(makeTask({ id: 'first' }))
      service.addFile(makeTask({ id: 'second' }))
      await flush()

      service.cancelTask('second')
      await flush()

      const second = service.getAllTasks().find((t) => t.id === 'second')!
      expect(second.status).toBe('failed')
      expect(second.error).toBe('Cancelled')
      // The SDK should never have been called for the cancelled task.
      expect(uploadFile).toHaveBeenCalledTimes(1)

      hang.resolve({ ok: true })
      await flush()
    })

    it('aborts an in-flight task and marks it failed/Cancelled', async () => {
      // The SDK contract: when signal is aborted, uploadFile rejects with
      // a FileStorageError-shaped object whose kind is 'Aborted'.
      const uploadFile = vi.fn(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('Aborted'), { kind: 'Aborted' }))
            })
          })
      )
      service = new FileUploadService(makeClient({ uploadFile }))

      service.addFile(makeTask({ id: 'live' }))
      await flush()

      const live = service.getAllTasks().find((t) => t.id === 'live')!
      expect(live.status).toBe('uploading')
      expect(live.abortController).toBeInstanceOf(AbortController)

      service.cancelTask('live')
      await flush()

      const after = service.getAllTasks().find((t) => t.id === 'live')!
      expect(after.status).toBe('failed')
      expect(after.error).toBe('Cancelled')
      expect(after.abortController).toBeUndefined()
    })
  })

  describe('retryTask', () => {
    it('restarts a failed task in place under the same id with a bumped retry counter', async () => {
      client = makeClient({
        uploadFile: vi
          .fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce({ ok: true }),
      })
      service = new FileUploadService(client)

      service.addFile(makeTask({ id: 'first' }))
      await flush()

      const first = service.getAllTasks().find((t) => t.id === 'first')!
      expect(first.status).toBe('failed')

      service.retryTask('first')
      await flush()

      const all = service.getAllTasks()
      // Retry mutates in place — no duplicate row, no key collision in the UI.
      expect(all).toHaveLength(1)
      const retried = all[0]
      expect(retried.id).toBe('first')
      expect(retried.retries).toBe(1)
      expect(retried.status).toBe('completed')
    })

    it('is a no-op for tasks not in the failed state', async () => {
      service.addFile(makeTask({ id: 'ok' }))
      await flush()

      service.retryTask('ok') // already completed
      service.retryTask('does-not-exist')
      await flush()

      expect(service.getAllTasks()).toHaveLength(1)
    })

    it('rapid double-retry enqueues the task exactly once', async () => {
      const uploadFile = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ ok: true })
      service = new FileUploadService(makeClient({ uploadFile }))

      service.addFile(makeTask({ id: 'r' }))
      await flush()
      expect(uploadFile).toHaveBeenCalledTimes(1)

      // Two retries fired in the same tick — second one must be a no-op.
      service.retryTask('r')
      service.retryTask('r')
      await flush()

      expect(uploadFile).toHaveBeenCalledTimes(2)
      expect(service.getAllTasks()).toHaveLength(1)
    })
  })

  describe('addFile promise', () => {
    it('resolves once the task reaches completed', async () => {
      const done = service.addFile(makeTask({ id: 'p' }))
      await expect(done).resolves.toBeUndefined()
      expect(service.getAllTasks().find((t) => t.id === 'p')!.status).toBe(
        'completed'
      )
    })

    it('resolves once the task fails', async () => {
      service = new FileUploadService(
        makeClient({
          uploadFile: vi.fn().mockRejectedValue(new Error('boom')),
        })
      )
      const done = service.addFile(makeTask({ id: 'p' }))
      await expect(done).resolves.toBeUndefined()
      expect(service.getAllTasks().find((t) => t.id === 'p')!.status).toBe(
        'failed'
      )
    })
  })

  describe('queueFileUploadsWithContext — concurrent batches', () => {
    it('two interleaved batches each resolve only with their own ids', async () => {
      // Slow first batch so it overlaps with the second batch's enqueue.
      const slow = deferred<{ ok: true }>()
      const uploadFile = vi
        .fn()
        .mockImplementationOnce(() => slow.promise)
        .mockResolvedValue({ ok: true })
      service = new FileUploadService(makeClient({ uploadFile }))

      const a = service.queueFileUploadsWithContext([
        { attachment: makeTask().attachment, objectUuid: 'obj-1' },
      ])
      const b = service.queueFileUploadsWithContext([
        { attachment: makeTask().attachment, objectUuid: 'obj-1' },
        { attachment: makeTask().attachment, objectUuid: 'obj-1' },
      ])
      let aDone = false
      void a.then(() => {
        aDone = true
      })

      // Batch B has no slow tasks — awaiting it must succeed even while
      // batch A is still in-flight. This is the property the old global-
      // callback hijack broke (B would never resolve until A resolved too).
      await b
      expect(aDone).toBe(false)

      slow.resolve({ ok: true })
      await a
      expect(aDone).toBe(true)
    })
  })

  describe('cancelTask — early cancel', () => {
    it('cancelling a pending task that has not started yet still aborts its signal', async () => {
      // Block the first task forever so the second never starts.
      const hang = deferred<{ ok: true }>()
      const uploadFile = vi
        .fn()
        .mockImplementationOnce(() => hang.promise)
        .mockResolvedValue({ ok: true })
      service = new FileUploadService(makeClient({ uploadFile }), {
        maxConcurrent: 1,
      })

      service.addFile(makeTask({ id: 'first' }))
      service.addFile(makeTask({ id: 'queued' }))
      await flush()

      const queued = service.getAllTasks().find((t) => t.id === 'queued')!
      // Pre-creation guarantee: signal exists from the moment addFile runs.
      expect(queued.abortController).toBeInstanceOf(AbortController)

      service.cancelTask('queued')
      await flush()

      expect(service.getAllTasks().find((t) => t.id === 'queued')!.status).toBe(
        'failed'
      )
      hang.resolve({ ok: true })
      await flush()
    })
  })

  describe('subscriber atomicity', () => {
    it('subscriber sees status=completed AND progress=100 in the same notification', async () => {
      const observed: Array<{ status: string; progress: number }> = []
      service.subscribe(() => {
        const t = service.getAllTasks().find((x) => x.id === 'atomic')
        if (t && t.status === 'completed') {
          observed.push({ status: t.status, progress: t.progress })
        }
      })

      service.addFile(makeTask({ id: 'atomic' }))
      await flush()

      expect(observed.length).toBeGreaterThanOrEqual(1)
      for (const o of observed) {
        expect(o.progress).toBe(100)
      }
    })
  })

  describe('setMaxConcurrent', () => {
    it('picks up queued work immediately when the cap is raised', async () => {
      // Two in-flight uploads — we'll add a third while concurrency is 2,
      // then raise to 3 and assert the third starts without waiting.
      const inflight: Array<Deferred<{ ok: true }>> = []
      const uploadFile = vi.fn(() => {
        const d = deferred<{ ok: true }>()
        inflight.push(d)
        return d.promise
      })

      service = new FileUploadService(makeClient({ uploadFile }), {
        maxConcurrent: 2,
      })

      service.addFile(makeTask({ id: 'a' }))
      service.addFile(makeTask({ id: 'b' }))
      service.addFile(makeTask({ id: 'c' }))

      await flush()

      // Only the first two should be uploading; c is still pending.
      const before = service.getAllTasks()
      expect(before.find((t) => t.id === 'a')!.status).toBe('uploading')
      expect(before.find((t) => t.id === 'b')!.status).toBe('uploading')
      expect(before.find((t) => t.id === 'c')!.status).toBe('pending')

      service.setMaxConcurrent(3)
      await flush()

      const after = service.getAllTasks()
      expect(after.find((t) => t.id === 'c')!.status).toBe('uploading')

      // Tidy up so the test doesn't leave dangling promises.
      inflight.forEach((d) => d.resolve({ ok: true }))
      await flush()
    })

    it('floors the cap at 1 even if a smaller value is passed', () => {
      service = new FileUploadService(makeClient())
      service.setMaxConcurrent(0)
      // Indirect check: enqueue 2 tasks, only one should run.
      const inflight: Array<Deferred<{ ok: true }>> = []
      const uploadFile = vi.fn(() => {
        const d = deferred<{ ok: true }>()
        inflight.push(d)
        return d.promise
      })
      service = new FileUploadService(makeClient({ uploadFile }), {
        maxConcurrent: 5,
      })
      service.setMaxConcurrent(-3)
      service.addFile(makeTask({ id: 'x' }))
      service.addFile(makeTask({ id: 'y' }))
      return Promise.resolve().then(async () => {
        await flush()
        const tasks = service.getAllTasks()
        const uploading = tasks.filter((t) => t.status === 'uploading')
        expect(uploading).toHaveLength(1)
        inflight.forEach((d) => d.resolve({ ok: true }))
      })
    })
  })

  describe('forceWatchdog', () => {
    it('transitions a cancelling task to failed without waiting 10s', async () => {
      const uploadFile = vi.fn(() => new Promise(() => {}))
      service = new FileUploadService(makeClient({ uploadFile }))

      service.addFile(makeTask({ id: 'stuck' }))
      await flush()

      service.cancelTask('stuck')
      expect(service.getTask('stuck')!.status).toBe('cancelling')

      service.forceWatchdog('stuck')
      expect(service.getTask('stuck')!.status).toBe('failed')
      expect(service.getTask('stuck')!.error).toBe('Cancelled')
    })

    it('is a no-op for tasks not in cancelling state', async () => {
      service = new FileUploadService(makeClient())
      service.addFile(makeTask({ id: 'done' }))
      await flush()
      // Task completed naturally; forceWatchdog should not flip it.
      expect(service.getTask('done')!.status).toBe('completed')
      service.forceWatchdog('done')
      expect(service.getTask('done')!.status).toBe('completed')
    })

    it('returns silently for unknown ids', () => {
      service = new FileUploadService(makeClient())
      expect(() => service.forceWatchdog('nope')).not.toThrow()
    })
  })

  describe('getTask', () => {
    it('returns the live task object by id, or undefined if missing', async () => {
      service = new FileUploadService(makeClient())
      service.addFile(makeTask({ id: 'a' }))
      await flush()
      expect(service.getTask('a')?.id).toBe('a')
      expect(service.getTask('missing')).toBeUndefined()
    })
  })

  describe('subscriber atomicity — failed', () => {
    it('failed status and error are visible in the same notification', async () => {
      client = makeClient({
        uploadFile: vi.fn().mockRejectedValue(new Error('disk full')),
      })
      service = new FileUploadService(client)

      const observed: Array<{ status: string; error?: string }> = []
      service.subscribe(() => {
        const t = service.getAllTasks().find((x) => x.id === 'bad')
        if (t && t.status === 'failed') {
          observed.push({ status: t.status, error: t.error })
        }
      })

      service.addFile(makeTask({ id: 'bad' }))
      await flush()

      expect(observed.length).toBeGreaterThanOrEqual(1)
      for (const o of observed) {
        // Whenever the subscriber sees 'failed', the error message must be
        // populated — never an empty interstitial state.
        expect(o.error).toBe('disk full')
      }
    })

    it('cancelling status is observed strictly before failed:Cancelled', async () => {
      const uploadFile = vi.fn(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('Aborted'), { kind: 'Aborted' }))
            })
          })
      )
      service = new FileUploadService(makeClient({ uploadFile }))

      const sequence: string[] = []
      service.subscribe(() => {
        const t = service.getAllTasks().find((x) => x.id === 'c')
        if (t) sequence.push(t.status)
      })

      service.addFile(makeTask({ id: 'c' }))
      await flush()
      service.cancelTask('c')
      await flush()

      const cancellingIdx = sequence.indexOf('cancelling')
      const failedIdx = sequence.indexOf('failed')
      expect(cancellingIdx).toBeGreaterThanOrEqual(0)
      expect(failedIdx).toBeGreaterThanOrEqual(0)
      expect(cancellingIdx).toBeLessThan(failedIdx)
    })
  })

  describe('cancelling watchdog', () => {
    it('forces a stuck cancelling task to failed after the timeout', async () => {
      vi.useFakeTimers()
      try {
        // Upload that ignores the abort signal — simulates a backend that
        // never acknowledges the cancel.
        const uploadFile = vi.fn(() => new Promise(() => {}))
        service = new FileUploadService(makeClient({ uploadFile }))

        service.addFile(makeTask({ id: 'stuck' }))
        // Let the upload start.
        await Promise.resolve()
        await Promise.resolve()

        service.cancelTask('stuck')
        // Cancelled, but the upload never resolves.
        expect(
          service.getAllTasks().find((t) => t.id === 'stuck')!.status
        ).toBe('cancelling')

        vi.advanceTimersByTime(11_000)

        expect(
          service.getAllTasks().find((t) => t.id === 'stuck')!.status
        ).toBe('failed')
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
