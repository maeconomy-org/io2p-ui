import { NextResponse } from 'next/server'

import { logger } from '@/lib/observability/logger'

/**
 * A TRIPWIRE, NOT AUTHENTICATION. Read this before putting a route behind it.
 *
 * It checks that the caller sent a Bearer token shaped like an unexpired JWT. It does NOT verify
 * the signature — there is no JWKS fetch and no key here — so anyone can satisfy it by base64ing
 * `{"exp": <future>}` into the middle segment. That is by design and costs nothing to bypass.
 *
 * What it is for: filtering traffic that is not the UI, and emitting a signal when that happens.
 * What bounds actual abuse is the rate limit next to it, not this.
 *
 * THE RULE: a route behind this may serve NO private data. Both current callers satisfy that
 * structurally rather than by promise — /api/address proxies a public geocoder with a server-held
 * key, so the caller can
 * only ever get back data they already had. Neither reads a user's records.
 *
 * A future route that touches private data does NOT get this. It gets real JWKS verification
 * against the issuer, or it proxies to io2p-core and lets core verify the token it forwards.
 */
export function tripwire(req: Request): NextResponse | null {
  const authorization = req.headers.get('authorization')

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return reject(req, 'missing bearer token')
  }

  const parts = authorization.slice(7).split('.')
  if (parts.length !== 3) return reject(req, 'malformed token')

  const exp = expiryOf(parts[1])
  // A token with no `exp` passes: better-auth always sets one, and rejecting on its absence would
  // turn a claim we do not verify into a hard gate. An exp in the PAST is a positive signal that
  // this is a stale copy, so that one is refused.
  if (exp !== null && Date.now() >= exp * 1000) {
    return reject(req, 'token expired')
  }

  return null
}

function expiryOf(payload: string | undefined): number | null {
  if (!payload) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof decoded?.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

function reject(req: Request, reason: string): NextResponse {
  // `warn`, not `error`: a rejection here is routine internet noise, and paging on it would be
  // paging on scanners. It is still worth counting — a spike is the abuse signal.
  logger.warn('ui_tripwire_rejected', {
    reason,
    path: new URL(req.url).pathname,
  })
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
