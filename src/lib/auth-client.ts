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

/** Drop the cached core token (call on logout / identity switch). */
export function clearCoreToken(): void {
  cachedToken = null
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

  const base = getCachedConfig()?.authBaseUrl ?? ''
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
