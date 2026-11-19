import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { UploadQueue } from '@/lib/upload-queue'

function makeClient() {
  const upload = vi.fn().mockResolvedValue({ file: { id: 'f1' } })
  return { client: { files: { upload } } as never, upload }
}

let seq = 0
function task(over: Record<string, unknown> = {}) {
  seq += 1
  return {
    id: `t${seq}`,
    fileName: 'a.pdf',
    size: 10,
    file: new File(['x'], 'a.pdf'),
    target: { entityId: 'o1' },
    ...over,
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('UploadQueue', () => {
  beforeEach(() => {
    seq = 0
    vi.useRealTimers()
  })

  it('uploads an enqueued file against its target', async () => {
    const { client, upload } = makeClient()
    const queue = new UploadQueue(client)

    queue.enqueue(task())
    await settle()

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][1]).toEqual({ entityId: 'o1' })
    expect(queue.getTasks()[0].status).toBe('completed')
    expect(queue.getTasks()[0].progress).toBe(100)
  })

  it('reports byte-level progress from the SDK', async () => {
    const { client, upload } = makeClient()
    upload.mockImplementation(async (_f, _t, options) => {
      options.onProgress({ loaded: 25, total: 100 })
      options.onProgress({ loaded: 50, total: 100 })
      return { file: { id: 'f1' } }
    })
    const queue = new UploadQueue(client)
    const seen: number[] = []
    queue.subscribe(() => seen.push(queue.getTasks()[0]?.progress ?? -1))

    queue.enqueue(task())
    await settle()

    expect(seen).toContain(25)
    expect(seen).toContain(50)
  })

  it('never runs more than the concurrency cap at once', async () => {
    const { client, upload } = makeClient()
    let running = 0
    let peak = 0
    upload.mockImplementation(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running -= 1
      return { file: { id: 'f' } }
    })
    const queue = new UploadQueue(client, { maxConcurrent: 2 })

    for (let i = 0; i < 5; i++) queue.enqueue(task())
    await new Promise((r) => setTimeout(r, 80))

    expect(upload).toHaveBeenCalledTimes(5)
    expect(peak).toBeLessThanOrEqual(2)
  })

  // The signal exists from enqueue, not from upload start — otherwise a queued file can't be
  // cancelled until it happens to get a slot.
  it('cancels a task that has not started yet, without uploading', async () => {
    const { client, upload } = makeClient()
    upload.mockImplementation(() => new Promise(() => {})) // never settles
    const queue = new UploadQueue(client, { maxConcurrent: 1 })

    queue.enqueue(task({ id: 'first' }))
    queue.enqueue(task({ id: 'second' }))
    queue.cancel('second')
    await settle()

    const second = queue.getTasks().find((t) => t.id === 'second')!
    expect(second.status).toBe('failed')
    expect(second.error).toBe('Cancelled')
    expect(upload).toHaveBeenCalledTimes(1) // only 'first' ever ran
  })

  it('treats an aborted upload as cancelled rather than an error', async () => {
    const { client, upload } = makeClient()
    upload.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    )
    const queue = new UploadQueue(client)

    queue.enqueue(task())
    await settle()

    expect(queue.getTasks()[0].error).toBe('Cancelled')
  })

  it('forces a stuck cancelling task to failed rather than spinning forever', async () => {
    vi.useFakeTimers()
    const { client, upload } = makeClient()
    upload.mockImplementation(() => new Promise(() => {})) // hangs, ignores the signal
    const queue = new UploadQueue(client)

    queue.enqueue(task({ id: 'stuck' }))
    await vi.advanceTimersByTimeAsync(0)
    queue.cancel('stuck')
    expect(queue.getTasks()[0].status).toBe('cancelling')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(queue.getTasks()[0].status).toBe('failed')
    vi.useRealTimers()
  })

  it('retries a failed task in place, keeping its id', async () => {
    const { client, upload } = makeClient()
    upload.mockRejectedValueOnce(new Error('network'))
    const queue = new UploadQueue(client)

    queue.enqueue(task({ id: 'retryable' }))
    await settle()
    expect(queue.getTasks()[0].status).toBe('failed')

    queue.retry('retryable')
    await settle()

    const [t] = queue.getTasks()
    expect(t.id).toBe('retryable') // same id, so the React key is stable
    expect(t.status).toBe('completed')
    expect(t.retries).toBe(1)
  })

  it('keeps failures when clearing completed, so they stay retryable', async () => {
    const { client, upload } = makeClient()
    upload
      .mockResolvedValueOnce({ file: {} })
      .mockRejectedValueOnce(new Error('boom'))
    const queue = new UploadQueue(client, { maxConcurrent: 1 })

    queue.enqueue(task({ id: 'ok' }))
    queue.enqueue(task({ id: 'bad' }))
    await new Promise((r) => setTimeout(r, 20))

    queue.clearCompleted()
    expect(queue.getTasks().map((t) => t.id)).toEqual(['bad'])
  })

  it('refuses to remove a task that is still running', async () => {
    const { client, upload } = makeClient()
    upload.mockImplementation(() => new Promise(() => {}))
    const queue = new UploadQueue(client)

    queue.enqueue(task({ id: 'busy' }))
    await settle()
    queue.remove('busy')

    expect(queue.getTasks()).toHaveLength(1)
  })

  it('notifies on settle so consumers can refresh the entity', async () => {
    const onSettled = vi.fn()
    const { client } = makeClient()
    const queue = new UploadQueue(client, { onSettled })

    queue.enqueue(task())
    await settle()

    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled.mock.calls[0][0].status).toBe('completed')
  })
})

afterEach(() => vi.useRealTimers())
