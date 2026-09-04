// Pins which x-forwarded-for entry the rate limiters key on. The identifier
// is a hash, so these assert the property that actually matters: which
// requests land in the SAME bucket and which do not.
//
// Both misconfigurations are real failures, in opposite directions — too few
// trusted hops and every client behind the outermost proxy shares one bucket,
// too many and an attacker picks their own bucket with a header.

import { describe, it, expect, vi, afterEach } from 'vitest'

import { getClientIdentifier, getClientIp } from '@/lib/http/rate-limit'

function req(headers: Record<string, string>): Request {
  return new Request('https://app.test/api/telemetry', { headers })
}

describe('getClientIdentifier — x-forwarded-for hop selection', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('ignores a client-prepended entry at the default single hop', () => {
    const honest = getClientIdentifier(req({ 'x-forwarded-for': '10.0.0.1' }))
    const spoofed = getClientIdentifier(
      req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    )
    // Our proxy appended 10.0.0.1; the attacker's own entry sits to its left
    // and must not move them to a different bucket.
    expect(spoofed).toBe(honest)
  })

  it('collapses distinct clients into one bucket when a second proxy is uncounted', () => {
    // nginx fronting a platform ingress: XFF is "client, nginx" and the
    // default single hop reads nginx for everyone. This is the failure
    // TRUSTED_PROXY_HOPS exists to fix — pinned so the cost is visible.
    const a = getClientIdentifier(
      req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.9' })
    )
    const b = getClientIdentifier(
      req({ 'x-forwarded-for': '2.2.2.2, 10.0.0.9' })
    )
    expect(a).toBe(b)
  })

  it('separates those same clients once the second hop is counted', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')
    const a = getClientIdentifier(
      req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.9' })
    )
    const b = getClientIdentifier(
      req({ 'x-forwarded-for': '2.2.2.2, 10.0.0.9' })
    )
    expect(a).not.toBe(b)
  })

  it('falls back to the leftmost entry when fewer hops arrive than configured', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '3')
    const id = getClientIdentifier(req({ 'x-forwarded-for': '1.1.1.1' }))
    expect(id).not.toBe('anonymous')
    // Same as reading that single entry directly — no crash, no undefined key.
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
    expect(getClientIdentifier(req({ 'x-forwarded-for': '1.1.1.1' }))).toBe(id)
  })

  it('rejects an invalid or below-range hop count rather than trusting more of the header', () => {
    const baseline = getClientIdentifier(
      req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.9' })
    )
    for (const bad of ['0', '-2', 'two', '']) {
      vi.stubEnv('TRUSTED_PROXY_HOPS', bad)
      expect(
        getClientIdentifier(req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.9' }))
      ).toBe(baseline)
    }
  })

  it('tolerates whitespace and empty entries in the header', () => {
    const clean = getClientIdentifier(
      req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.9' })
    )
    expect(
      getClientIdentifier(req({ 'x-forwarded-for': ' 1.1.1.1 ,, 10.0.0.9 ,' }))
    ).toBe(clean)
  })

  it('falls back to x-real-ip, then to anonymous', () => {
    expect(getClientIdentifier(req({ 'x-real-ip': '9.9.9.9' }))).not.toBe(
      'anonymous'
    )
    expect(getClientIdentifier(req({}))).toBe('anonymous')
  })

  it('separates two clients sharing an address but not a user agent', () => {
    const a = getClientIdentifier(
      req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'Firefox' })
    )
    const b = getClientIdentifier(
      req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'Safari' })
    )
    expect(a).not.toBe(b)
  })
})

// The reason there are two functions rather than one. Telemetry WANTS the user-agent in its key
// (fairness between browsers behind one NAT); a protection limit must not have it, because the
// caller chooses their own user-agent and would mint a fresh bucket per request.
describe('getClientIp — the protection key', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('does not let a rotating user agent escape the bucket', () => {
    const chrome = getClientIp(
      req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'Chrome' })
    )
    const curl = getClientIp(
      req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'curl/8.4.0' })
    )
    expect(chrome).toBe(curl)
    // ...whereas the telemetry identifier deliberately would.
    expect(
      getClientIdentifier(
        req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'Chrome' })
      )
    ).not.toBe(
      getClientIdentifier(
        req({ 'x-forwarded-for': '10.0.0.9', 'user-agent': 'curl/8.4.0' })
      )
    )
  })

  it('applies the same trusted-hop rule as the hashed identifier', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe(
      '10.0.0.1'
    )
  })

  it('returns anonymous when no address header arrives', () => {
    expect(getClientIp(req({}))).toBe('anonymous')
  })
})
