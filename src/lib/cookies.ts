/**
 * The one cookie utility. Isomorphic and side-effect free at module scope, so a
 * Server Component and a client component can both import it.
 *
 * It deliberately does NOT wrap `next/headers` — that would pull a server-only
 * module into every client bundle that reaches for `readCookie`. A server caller
 * passes the header string to `parseCookieHeader` itself.
 */

export interface CookieOptions {
  path?: string
  maxAge?: number
  sameSite?: 'Lax' | 'Strict' | 'None'
}

/** One year — a preference, not a session artefact. */
export const COOKIE_DEFAULTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  // `Lax`, not `Strict`: Strict withholds the cookie on the top-level navigation
  // back from the auth issuer, which is the one moment a wrong first paint shows.
  sameSite: 'Lax',
} as const satisfies Required<CookieOptions>

/**
 * `Secure` is conditional because dev and e2e both run on plain http
 * (`next dev`, and Playwright's `http://localhost:3000`). A browser silently
 * DISCARDS a `Secure` cookie on an insecure origin, so hardcoding the flag
 * would make every preference look unwritable locally while working in prod.
 */
function isSecureContext(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'https:'
}

/** Parse a `Cookie:` request header into a name → value map. */
export function parseCookieHeader(
  header: string | null | undefined
): Record<string, string> {
  const jar: Record<string, string> = {}
  if (!header) return jar
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 1) continue
    // Split on the FIRST `=` only — a base64 or packed value may contain more.
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  return jar
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const { path, maxAge, sameSite } = { ...COOKIE_DEFAULTS, ...options }
  const parts = [
    `${name}=${value}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ]
  if (isSecureContext()) parts.push('Secure')
  return parts.join('; ')
}

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return parseCookieHeader(document.cookie)[name]
}

export function writeCookie(
  name: string,
  value: string,
  options?: CookieOptions
): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeCookie(name, value, options)
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeCookie(name, '', { maxAge: 0 })
}
