// Process-level fatal handlers: unhandledRejection/uncaughtException must be
// logged structured through the logger ({ err }), flushed best-effort, and
// then crash the process (exit 1) — never keep a corrupted process alive,
// never throw from the handler itself, never double-register.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockError = vi.fn()
vi.mock('@/lib/logger/index', () => ({
  logger: { error: (...args: unknown[]) => mockError(...args) },
}))

import {
  FATAL_FLUSH,
  registerFatalHandlers,
  resetFatalStateForTests,
} from '@/lib/logger/fatal'

type Handler = (err: unknown) => void

describe('registerFatalHandlers', () => {
  let handlers: Map<string, Handler>
  let onSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetFatalStateForTests()
    mockError.mockReset()
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

  it('logs the real error under err and exits 1', async () => {
    registerFatalHandlers()
    const boom = new Error('background job exploded')
    handlers.get('unhandledRejection')!(boom)

    expect(mockError).toHaveBeenCalledTimes(1)
    const [msg, fields] = mockError.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(msg).toBe('Fatal: unhandledRejection')
    expect(fields.err).toBe(boom)
    expect(fields.fatal).toBe(true)
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

  it('never throws, even when the logger itself throws', async () => {
    registerFatalHandlers()
    mockError.mockImplementation(() => {
      throw new Error('logger broken')
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
    expect(mockError).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
  })
})
