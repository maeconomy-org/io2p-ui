import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NetworkError, TimeoutError, type ClientOptions } from 'io2p-client'

import { logger } from '@/lib/observability/logger'
import { createIo2pClient, DEFAULT_IO2P_TIMEOUT_MS } from '@/lib/io2p'
import {
  isNodeUnreachable,
  isTimeout,
  wasErrorReported,
} from '@/lib/io2p-errors'

const createClientMock = vi.hoisted(() =>
  vi.fn((_options: unknown) => ({}) as unknown)
)

vi.mock('io2p-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('io2p-client')>()
  return { ...actual, createClient: createClientMock }
})

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/auth/client', () => ({
  getCoreToken: vi.fn(async () => 'jwt'),
}))

function buildOptions(timeoutMs?: number): ClientOptions {
  if (timeoutMs === undefined) createIo2pClient('https://node.example')
  else createIo2pClient('https://node.example', timeoutMs)
  return createClientMock.mock.calls.at(-1)![0] as unknown as ClientOptions
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createIo2pClient wiring', () => {
  it('passes every observability seam through to createClient', () => {
    const opts = buildOptions()
    expect(opts.baseUrl).toBe('https://node.example')
    expect(typeof opts.fetch).toBe('function')
    expect(opts.logger).toBeDefined()
    expect(typeof opts.onResponse).toBe('function')
    expect(typeof opts.onError).toBe('function')
    expect(typeof opts.traceHeaders).toBe('function')
  })

  it('applies the 30s default timeout, overridable per call', () => {
    expect(DEFAULT_IO2P_TIMEOUT_MS).toBe(30_000)
    expect(buildOptions().timeoutMs).toBe(30_000)
    expect(buildOptions(5_000).timeoutMs).toBe(5_000)
  })
})

describe('logger adapter', () => {
  it('namespaces context with scope and forwards each level', () => {
    const opts = buildOptions()
    opts.logger!.debug('sdk detail', { attempt: 2 })
    expect(logger.debug).toHaveBeenCalledWith('sdk detail', {
      scope: 'io2p-client',
      attempt: 2,
    })
    opts.logger!.warn('sdk warning')
    expect(logger.warn).toHaveBeenCalledWith('sdk warning', {
      scope: 'io2p-client',
    })
  })

  it('redacts presigned-URL credentials in string values', () => {
    const opts = buildOptions()
    opts.logger!.error('upload cleanup failed', {
      url: 'https://bucket.s3.example/key?X-Amz-Signature=abc123&X-Amz-Credential=AKIA%2Fus',
    })
    expect(logger.error).toHaveBeenCalledWith('upload cleanup failed', {
      scope: 'io2p-client',
      url: 'https://bucket.s3.example/key?X-Amz-Signature=REDACTED&X-Amz-Credential=REDACTED',
    })
  })
})

describe('onResponse', () => {
  it('logs a debug record with the path only — never the query string', () => {
    const opts = buildOptions()
    opts.onResponse!({
      method: 'GET',
      url: 'https://node.example/api/v1/objects?cursor=abc&limit=50',
      status: 200,
      durationMs: 12,
      retried: false,
    })
    expect(logger.debug).toHaveBeenCalledWith('io2p request', {
      scope: 'io2p-client',
      method: 'GET',
      path: '/api/v1/objects',
      status: 200,
      ms: 12,
      retried: false,
    })
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('adds a warn when the silent 401 retry served the response', () => {
    const opts = buildOptions()
    opts.onResponse!({
      method: 'PATCH',
      url: 'https://node.example/api/v1/objects/uuid-1',
      status: 200,
      durationMs: 80,
      retried: true,
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'io2p 401 retried',
      expect.objectContaining({
        method: 'PATCH',
        path: '/api/v1/objects/uuid-1',
        retried: true,
      })
    )
  })
})

describe('onError', () => {
  const info = {
    method: 'POST',
    url: 'https://node.example/api/v1/objects?validate=strict',
    status: 422,
    durationMs: 40,
  }

  it('logs with the error under fields.err and the query stripped', () => {
    const opts = buildOptions()
    const err = new Error('boom')
    opts.onError!(err, info)
    expect(logger.error).toHaveBeenCalledWith('io2p request failed', {
      scope: 'io2p-client',
      err,
      method: 'POST',
      path: '/api/v1/objects',
      status: 422,
      ms: 40,
    })
  })

  it('logs caller aborts at debug, never error — unmounts are not failures', () => {
    const opts = buildOptions()
    // Raw DOMException shape (React Query aborting on unmount).
    const abort = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    })
    opts.onError!(abort, { ...info, status: 0 })
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalledWith(
      'io2p request aborted',
      expect.objectContaining({ err: abort, path: '/api/v1/objects' })
    )

    // Abort arriving as the CAUSE of the SDK's wrapper error.
    const wrapped = new Error('fetch failed', {
      cause: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    })
    opts.onError!(wrapped, { ...info, status: 0 })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('keeps TimeoutError at error level — budget exhaustion is a real failure', () => {
    const opts = buildOptions()
    opts.onError!(new TimeoutError('budget exceeded'), { ...info, status: 0 })
    expect(logger.error).toHaveBeenCalledWith(
      'io2p request failed',
      expect.objectContaining({ status: 0 })
    )
  })

  // React Query's global handlers see the same error object again. Marking it
  // here is what stops one failure producing two error records — and two
  // Sentry captures — from two layers.
  it('marks a logged failure as reported', () => {
    const opts = buildOptions()
    const err = new Error('boom')
    expect(wasErrorReported(err)).toBe(false)
    opts.onError!(err, info)
    expect(wasErrorReported(err)).toBe(true)
  })

  it('does NOT mark an abort — it was never reported at error level', () => {
    const opts = buildOptions()
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    opts.onError!(abort, { ...info, status: 0 })
    expect(wasErrorReported(abort)).toBe(false)
  })
})

describe('traceHeaders', () => {
  it('returns undefined in a browser-like environment and never throws', () => {
    const opts = buildOptions()
    // jsdom has a `window`, so this exercises the browser guard.
    expect(opts.traceHeaders!()).toBeUndefined()
    expect(() => opts.traceHeaders!()).not.toThrow()
  })
})

describe('network/timeout discrimination (io2p-errors)', () => {
  it('recognises NetworkError (status 0) as node-unreachable', () => {
    expect(isNodeUnreachable(new NetworkError('fetch failed'))).toBe(true)
    expect(isNodeUnreachable({ status: 0 })).toBe(true)
    expect(isNodeUnreachable({ status: 503 })).toBe(false)
    expect(isNodeUnreachable(new Error('boom'))).toBe(false)
  })

  it('recognises TimeoutError by name, never instanceof', () => {
    expect(isTimeout(new TimeoutError('budget exceeded'))).toBe(true)
    // A duplicated module copy still matches by shape.
    expect(isTimeout({ name: 'TimeoutError', status: 0 })).toBe(true)
    expect(isTimeout(new NetworkError('fetch failed'))).toBe(false)
    expect(isTimeout(null)).toBe(false)
  })

  it('a TimeoutError is also node-unreachable (status 0 subclass)', () => {
    expect(isNodeUnreachable(new TimeoutError('budget exceeded'))).toBe(true)
  })
})
