'use client'

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

import { getCachedConfig } from '@/constants/client'

// Every plugin except this one is declared on the io2p-auth SERVER and discovered over the wire;
// twoFactorClient is here because the redirect it performs happens in the browser.
const authBaseUrl = getCachedConfig()?.authBaseUrl || undefined

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window !== 'undefined') {
          window.location.href = '/two-factor'
        }
      },
    }),
  ],
})

export const { useSession, signIn, signOut } = authClient

// io2p-client calls getToken() before EVERY request, so the ~15-min JWT is cached and reused.
let cachedToken: { token: string; expMs: number } | null = null

function jwtExpMs(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

// Dedupes concurrent misses: the result cache is only written after the fetch resolves, so without
// this two callers that both miss each fire their own mint.
let inFlight: Promise<string> | null = null

/** Drop the cached core token (call on logout / identity switch). */
export function clearCoreToken(): void {
  cachedToken = null
  inFlight = null
}

/**
 * Mint (or return the cached) short-lived JWT io2p-core expects as a Bearer token. The better-auth
 * session cookie authenticates the mint request; io2p-core verifies the JWT offline via the issuer's
 * JWKS. Handed to `createClient({ getToken })`.
 */
export async function getCoreToken(opts?: {
  force?: boolean
}): Promise<string> {
  const now = Date.now()
  // Refresh 60s early to avoid handing io2p-core a token that expires mid-flight.
  if (!opts?.force && cachedToken && cachedToken.expMs - 60_000 > now) {
    return cachedToken.token
  }

  // `force` is the client's one-shot retry after a 401 — it bypasses the join because it is asking
  // for a NEW token precisely because the in-flight one was rejected.
  if (!opts?.force && inFlight) {
    return inFlight
  }

  const promise = mintCoreToken(now)
  if (!opts?.force) {
    inFlight = promise
    // Two handlers rather than `.finally()`: that would derive a NEW promise, which rejects
    // unobserved when the mint fails.
    const clear = () => {
      if (inFlight === promise) inFlight = null
    }
    promise.then(clear, clear)
  }
  return promise
}

async function mintCoreToken(now: number): Promise<string> {
  const base = getCachedConfig()?.authBaseUrl ?? ''
  // Named rather than left to fail silently: if the inline __IOM_CONFIG__ script is ever deferred,
  // moved out of <head> or CSP-blocked, `base` is '' and every mint posts to a same-origin path
  // that does not exist — a 404 storm with no obvious cause.
  if (!base) {
    throw new Error(
      'authBaseUrl missing from runtime config: the inline __IOM_CONFIG__ ' +
        'script must execute before any core token is minted.'
    )
  }
  const res = await fetch(`${base}/api/auth/token`, { credentials: 'include' })
  if (!res.ok) {
    // No "token" in the text: Sentry's server-side scrubber matches that word and
    // masks the WHOLE message, hiding the status — the only part worth reading.
    throw new Error(`core credential mint rejected: ${res.status}`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error('Token endpoint returned no token')
  }

  cachedToken = {
    token: data.token,
    expMs: jwtExpMs(data.token) || now + 14 * 60_000,
  }
  return data.token
}
