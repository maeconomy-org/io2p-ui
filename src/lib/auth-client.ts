'use client'

import { createAuthClient } from 'better-auth/react'

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
})

export const { useSession, signIn, signOut } = authClient

/**
 * Mint the short-lived (~15 min) JWT that io2p-core expects as a Bearer token.
 * The better-auth session cookie authenticates this request (`credentials:
 * 'include'`); io2p-core verifies the JWT offline via the issuer's JWKS. This
 * is the closure handed to `createClient({ getToken })` — the io2p-client
 * re-invokes it with `{ force: true }` once on a 401, and since the endpoint
 * always mints fresh from the session, no client-side caching is needed here.
 */
export async function getCoreToken(_opts?: {
  force?: boolean
}): Promise<string> {
  const base = getCachedConfig()?.authBaseUrl ?? ''
  const res = await fetch(`${base}/api/auth/token`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to mint core token: ${res.status}`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error('Token endpoint returned no token')
  }
  return data.token
}
