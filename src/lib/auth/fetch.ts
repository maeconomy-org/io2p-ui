/**
 * Authenticated fetch wrapper for internal /api/* routes. Attaches the io2p-core JWT
 * (minted + cached by getCoreToken) as a Bearer header.
 */

import { getCoreToken } from '@/lib/auth/client'

export async function authFetch(
  url: string,
  options: globalThis.RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)

  try {
    const token = await getCoreToken()
    headers.set('Authorization', `Bearer ${token}`)
  } catch {
    // No session / mint failed — send unauthenticated; the route responds 401.
  }

  return fetch(url, { ...options, headers })
}
