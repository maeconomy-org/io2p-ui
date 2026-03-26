/**
 * Authenticated fetch wrapper for internal API routes.
 * Reads the JWT token from the SDK's localStorage state
 * and attaches it as an Authorization header.
 */

const STORAGE_KEY = 'iom-auth-state'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const { token } = JSON.parse(stored)
    return token || null
  } catch {
    return null
  }
}

/**
 * Fetch wrapper that automatically attaches the JWT Authorization header.
 * Use this for calls to internal /api/* routes that require auth.
 */
export async function authFetch(
  url: string,
  options: globalThis.RequestInit = {}
): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
