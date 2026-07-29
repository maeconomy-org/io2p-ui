'use client'

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

import { getCachedConfig } from '@/constants/client'

// Thin better-auth "wire" client. ALL plugins (jwt, mtls, lastLoginMethod, …)
// are declared on the io2p-auth *server*; the client only needs the issuer
// origin and discovers capabilities over the wire. io2p-auth ships no package,
// so there is nothing to import from it — use better-auth/react directly.
//
// baseURL comes from runtime config (window.__IOM_CONFIG__, injected by the
// inline <script> before the bundle runs) so one Docker image serves every
// environment. On the server the module still evaluates (client components are
// SSR'd) but authClient is never *called* there, so the fallback is harmless.
const authBaseUrl = getCachedConfig()?.authBaseUrl || undefined

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  // twoFactorClient is the client counterpart to the issuer's `twoFactor`
  // server plugin — it exposes authClient.twoFactor.* for the settings UI and
  // routes a 2FA-enabled user to /two-factor to verify after sign-in.
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

// The io2p-client calls getToken() before EVERY request, so the ~15-min JWT is cached in-memory and
// reused until shortly before it expires. A `force` (the client's one-shot retry on a 401) or logout
// bypasses/clears the cache.
let cachedToken: { token: string; expMs: number } | null = null

function jwtExpMs(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

// The mint currently in flight, if any. Without this, two callers that both miss
// the cache each fire their own request: the result cache is only written AFTER
// the fetch resolves, so it can't dedupe concurrent callers. Running /me in
// parallel with the first list query made that race routine rather than rare.
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

  // Join the mint already running rather than starting a second one. `force`
  // (the client's one-shot 401 retry) deliberately bypasses this — it is asking
  // for a NEW token precisely because the in-flight/cached one was rejected.
  if (!opts?.force && inFlight) {
    return inFlight
  }

  const promise = mintCoreToken(now)
  if (!opts?.force) {
    inFlight = promise
    // Clear on settle either way: a failed mint must not pin every later caller
    // to the same rejection. Two handlers rather than `.finally()` — that would
    // derive a NEW promise which rejects unobserved when the mint fails.
    const clear = () => {
      if (inFlight === promise) inFlight = null
    }
    promise.then(clear, clear)
  }
  return promise
}

async function mintCoreToken(now: number): Promise<string> {
  const base = getCachedConfig()?.authBaseUrl ?? ''
  // Config is read at call time from the inline __IOM_CONFIG__ script. If that
  // script is ever deferred, moved out of <head>, or CSP-blocked, `base` is ''
  // and every mint silently posts to a same-origin path that doesn't exist —
  // a 404 storm with no obvious cause. Name it instead.
  if (!base) {
    throw new Error(
      'authBaseUrl missing from runtime config: the inline __IOM_CONFIG__ ' +
        'script must execute before any core token is minted.'
    )
  }
  const res = await fetch(`${base}/api/auth/token`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to mint core token: ${res.status}`)
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
