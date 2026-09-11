// Process-level fatal handlers: unhandledRejection/uncaughtException must be
// written SYNCHRONOUSLY to fd 1 (fs.writeSync — process.stdout.write is async
// on pipes and process.exit() does not drain it, so the plain sink could lose
// the one line this feature exists for), flushed best-effort, and then crash
// the process (exit 1) — never keep a corrupted process alive, never throw
// from the handler itself, never double-register.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const writeSyncMock = vi.fn()
vi.mock('fs', () => {
  const writeSync = (...args: unknown[]) => writeSyncMock(...args)
  return { writeSync, default: { writeSync } }
})

import {
  FATAL_FLUSH,
  registerFatalHandlers,
  resetFatalStateForTests,
} from '@/lib/observability/logger/fatal'

type Handler = (err: unknown) => void

function writtenRecord(): Record<string, unknown> {
  const [fd, line] = writeSyncMock.mock.calls[0] as [number, string]
  expect(fd).toBe(1)
  expect(line.endsWith('\n')).toBe(true)
  return JSON.parse(line)
}

describe('registerFatalHandlers', () => {
  let handlers: Map<string, Handler>
  let onSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetFatalStateForTests()
    writeSyncMock.mockReset()
    handlers = new Map()
    // Capture instead of attaching — attaching real fatal handlers to the
    // vitest process would fight the test runner's own.
    onSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: Handler
    ) => {
      handlers.set(event, handler)
      return process
    }) as never)
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
  })

  afterEach(() => {
    onSpy.mockRestore()
    exitSpy.mockRestore()
    resetFatalStateForTests()
  })

  it('registers both handlers exactly once, even when called twice (HMR)', () => {
    registerFatalHandlers()
    registerFatalHandlers()
    expect(onSpy).toHaveBeenCalledTimes(2)
    expect(handlers.has('unhandledRejection')).toBe(true)
    expect(handlers.has('uncaughtException')).toBe(true)
  })

  it('writes the fatal record synchronously to fd 1 and exits 1', async () => {
    registerFatalHandlers()
    const boom = new Error('background job exploded')
    handlers.get('unhandledRejection')!(boom)

    // fs.writeSync(1, ndjsonLine) — the wire, not the async stdout sink.
    expect(writeSyncMock).toHaveBeenCalledTimes(1)
    const rec = writtenRecord()
    expect(rec.level).toBe('error')
    expect(rec.msg).toBe('Fatal: unhandledRejection')
    expect(rec.fatal).toBe(true)
    expect((rec.err as { message: string }).message).toBe(
      'background job exploded'
    )
    expect((rec.err as { stack?: string }).stack).toContain(
      'background job exploded'
    )
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
  })

  it('awaits the OTel flush hook (bounded) before exiting', async () => {
    registerFatalHandlers()
    const flush = vi.fn(async () => {})
    ;(globalThis as Record<PropertyKey, unknown>)[FATAL_FLUSH] = flush

    handlers.get('uncaughtException')!(new Error('sync crash'))
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('still exits when the flush hook rejects', async () => {
    registerFatalHandlers()
    ;(globalThis as Record<PropertyKey, unknown>)[FATAL_FLUSH] = vi.fn(
      async () => {
        throw new Error('flush broken')
      }
    )
    handlers.get('unhandledRejection')!(new Error('x'))
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
  })

  it('never throws, even when writeSync itself throws', async () => {
    registerFatalHandlers()
    writeSyncMock.mockImplementation(() => {
      throw new Error('fd 1 gone')
    })
    expect(() =>
      handlers.get('uncaughtException')!(new Error('original'))
    ).not.toThrow()
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
  })

  it('ignores a second fatal while already exiting', async () => {
    registerFatalHandlers()
    handlers.get('unhandledRejection')!(new Error('first'))
    handlers.get('unhandledRejection')!(new Error('second'))
    expect(writeSyncMock).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
  })
})
