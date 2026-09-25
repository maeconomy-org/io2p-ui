// Pins the FIXED-window semantics of the telemetry rate limiter: an entry keeps its original
// reset time as the count rises. A sliding window would push the expiry out on every hit, so
// sustained traffic (the ship sink flushes every 5s) would accumulate to the cap and then be
// 429'd permanently.
//
// These cases were written against a Redis-backed limiter with an in-memory fallback. Redis went
// with the old import pipeline, and that fallback — already the path taken whenever Redis was
// unavailable — is now the only one. The PROPERTY under test is unchanged; only the store is, so
// the assertions moved from "did we call EXPIRE?" to the behaviour EXPIRE existed to produce.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { checkSimpleRateLimit } from '@/lib/http/rate-limit'

// A fresh identifier per case: the counter lives in a module-level Map, so a shared one would
// leak state between tests.
let seq = 0
const id = () => `client-${(seq += 1)}`

describe('checkSimpleRateLimit (fixed window)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts up within the window', () => {
    const client = id()
    expect(checkSimpleRateLimit('telemetry', client, 3, 60)).toEqual({
      allowed: true,
      current: 1,
    })
    expect(checkSimpleRateLimit('telemetry', client, 3, 60)).toEqual({
      allowed: true,
      current: 2,
    })
  })

  it('denies above the cap', () => {
    const client = id()
    checkSimpleRateLimit('telemetry', client, 2, 60)
    checkSimpleRateLimit('telemetry', client, 2, 60)
    expect(checkSimpleRateLimit('telemetry', client, 2, 60)).toEqual({
      allowed: false,
      current: 3,
    })
  })

  it('does NOT slide the window — a late hit does not extend it', () => {
    const client = id()
    checkSimpleRateLimit('telemetry', client, 5, 60)
    vi.advanceTimersByTime(59_000)
    checkSimpleRateLimit('telemetry', client, 5, 60) // would push the expiry out if sliding
    vi.advanceTimersByTime(2_000) // past the ORIGINAL 60s

    // A fresh window, not a continuation of the old count.
    expect(checkSimpleRateLimit('telemetry', client, 5, 60)).toEqual({
      allowed: true,
      current: 1,
    })
  })

  it('starts a new window once the old one expires', () => {
    const client = id()
    checkSimpleRateLimit('telemetry', client, 1, 60)
    expect(checkSimpleRateLimit('telemetry', client, 1, 60).allowed).toBe(false)

    vi.advanceTimersByTime(61_000)
    expect(checkSimpleRateLimit('telemetry', client, 1, 60)).toEqual({
      allowed: true,
      current: 1,
    })
  })

  it('keeps separate counters per scope and per identifier', () => {
    const a = id()
    const b = id()
    checkSimpleRateLimit('telemetry', a, 1, 60)
    // A different client is unaffected…
    expect(checkSimpleRateLimit('telemetry', b, 1, 60).allowed).toBe(true)
    // …and so is the same client under a different scope.
    expect(checkSimpleRateLimit('other', a, 1, 60).allowed).toBe(true)
  })
})
