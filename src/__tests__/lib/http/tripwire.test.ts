// Pins what the tripwire DOES and, just as importantly, what it does not.
//
// The forgery case is an assertion, not an oversight: if someone later "fixes" it by adding
// signature verification, this test fails and forces them to read the docblock explaining that
// routes behind it are chosen for serving no private data.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { tripwire } from '@/lib/http/tripwire'

function token(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

function req(authorization?: string): Request {
  return new Request('https://app.test/api/address', {
    headers: authorization ? { authorization } : {},
  })
}

const future = Math.floor(Date.now() / 1000) + 3600
const past = Math.floor(Date.now() / 1000) - 3600

describe('tripwire', () => {
  it('passes a well-formed unexpired token', () => {
    expect(tripwire(req(`Bearer ${token({ exp: future })}`))).toBeNull()
  })

  it('accepts the scheme in any case', () => {
    expect(tripwire(req(`bearer ${token({ exp: future })}`))).toBeNull()
    expect(tripwire(req(`BEARER ${token({ exp: future })}`))).toBeNull()
  })

  it('rejects a missing, non-bearer or malformed token with 401', () => {
    expect(tripwire(req())?.status).toBe(401)
    expect(tripwire(req('Basic abc'))?.status).toBe(401)
    expect(tripwire(req('Bearer not-a-jwt'))?.status).toBe(401)
    expect(tripwire(req('Bearer only.two'))?.status).toBe(401)
  })

  it('rejects an expired token', () => {
    expect(tripwire(req(`Bearer ${token({ exp: past })}`))?.status).toBe(401)
  })

  it('passes a token with no exp claim', () => {
    // Refusing here would turn a claim we never verify into a hard gate, for no gain.
    expect(tripwire(req(`Bearer ${token({ sub: 'u1' })}`))).toBeNull()
  })

  it('passes an undecodable payload rather than guessing', () => {
    expect(tripwire(req('Bearer header.%%%.signature'))).toBeNull()
  })

  it('IS FORGEABLE, by design', () => {
    // Anyone can mint this in a console. Nothing behind the tripwire may serve private data;
    // abuse is bounded by the rate limit beside it, not by this.
    const forged = `Bearer ${token({ exp: future, sub: 'anyone-at-all' })}`
    expect(tripwire(req(forged))).toBeNull()
  })
})
