// Pins the FIXED-window semantics of the Redis rate limiters: the expiry is
// set only when INCR creates the key (or a crash left it TTL-less). The old
// behavior ran EXPIRE on every request, which slid the window forever —
// sustained traffic (the ship sink flushes every 5s) accumulated to the cap
// and was then 429'd permanently.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const incrMock = vi.fn()
const ttlMock = vi.fn()
const expireMock = vi.fn(async () => 1)

type PipelineResult = [null, number][]

let pipelineResults: PipelineResult

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    pipeline: () => ({
      incr: incrMock,
      ttl: ttlMock,
      exec: async () => pipelineResults,
    }),
    expire: (...args: unknown[]) => expireMock(...(args as [])),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { security: vi.fn() },
  logSecurityEvent: vi.fn(),
}))

import { checkSimpleRateLimit } from '@/lib/security-utils'

describe('checkSimpleRateLimit (fixed window)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets the expiry when INCR creates the key', async () => {
    pipelineResults = [
      [null, 1], // INCR → first hit
      [null, -1], // TTL → none yet
    ]
    const res = await checkSimpleRateLimit('telemetry', 'c1', 60, 60)
    expect(res).toEqual({ allowed: true, current: 1 })
    expect(expireMock).toHaveBeenCalledTimes(1)
    expect(expireMock).toHaveBeenCalledWith('rate_limit:telemetry:c1', 60)
  })

  it('does NOT refresh the expiry on subsequent hits — the window must not slide', async () => {
    pipelineResults = [
      [null, 17], // INCR → established window
      [null, 42], // TTL → still counting down
    ]
    const res = await checkSimpleRateLimit('telemetry', 'c1', 60, 60)
    expect(res.allowed).toBe(true)
    expect(expireMock).not.toHaveBeenCalled()
  })

  it('repairs a missing TTL (crash between INCR and EXPIRE)', async () => {
    pipelineResults = [
      [null, 17],
      [null, -1], // key exists but has no expiry — would live forever
    ]
    await checkSimpleRateLimit('telemetry', 'c1', 60, 60)
    expect(expireMock).toHaveBeenCalledTimes(1)
  })

  it('denies above the cap without touching the expiry', async () => {
    pipelineResults = [
      [null, 61],
      [null, 30],
    ]
    const res = await checkSimpleRateLimit('telemetry', 'c1', 60, 60)
    expect(res.allowed).toBe(false)
    expect(expireMock).not.toHaveBeenCalled()
  })
})
