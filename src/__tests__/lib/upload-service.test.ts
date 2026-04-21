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
  uploadFileDirect?: ReturnType<typeof vi.fn>
  uploadFileByReference?: ReturnType<typeof vi.fn>
}) {
  return {
    node: {
      uploadFileDirect:
        overrides?.uploadFileDirect ?? vi.fn().mockResolvedValue({ ok: true }),
      uploadFileByReference:
        overrides?.uploadFileByReference ??
        vi.fn().mockResolvedValue({ ok: true }),
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

  describe('processQueue — sequential', () => {
    it('drains sequentially: second task stays pending until first settles', async () => {
      const d1 = deferred<{ ok: true }>()
      const d2 = deferred<{ ok: true }>()

      const uploadFileDirect = vi
        .fn()
        .mockImplementationOnce(() => d1.promise)
        .mockImplementationOnce(() => d2.promise)

      service = new FileUploadService(makeClient({ uploadFileDirect }))

      service.addFile(makeTask({ id: 'first' }))
      service.addFile(makeTask({ id: 'second' }))
      await flush()

      const statusAfterEnqueue = service
        .getAllTasks()
        .reduce<Record<string, string>>((acc, t) => {
          acc[t.id] = t.status
          return acc
        }, {})

      expect(statusAfterEnqueue.first).toBe('uploading')
      expect(statusAfterEnqueue.second).toBe('pending')

      d1.resolve({ ok: true })
      await flush()

      const mid = service
        .getAllTasks()
        .reduce<Record<string, string>>((acc, t) => {
          acc[t.id] = t.status
          return acc
        }, {})
      expect(mid.first).toBe('completed')
      expect(mid.second).toBe('uploading')

      d2.resolve({ ok: true })
      await flush()

      expect(service.getUploadSummary().completed).toHaveLength(2)
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
        uploadFileDirect: vi.fn().mockRejectedValue(new Error('boom')),
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
      const uploadFileDirect = vi.fn()
      service = new FileUploadService(
        makeClient({ uploadFileByReference, uploadFileDirect })
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
      expect(uploadFileDirect).not.toHaveBeenCalled()
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
        uploadFileDirect: vi.fn().mockRejectedValue(new Error('nope')),
      })
      service = new FileUploadService(client)

      service.addFile(makeTask({ id: 'bad' }))
      await flush()

      service.clearCompleted()

      expect(service.getAllTasks().map((t) => t.id)).toEqual(['bad'])
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
        uploadFileDirect: vi.fn().mockRejectedValue(new Error('x')),
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
})
