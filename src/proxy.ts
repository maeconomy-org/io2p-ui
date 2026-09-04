import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import { PUBLIC_PAGES_SET } from '@/constants/auth'
import {
  PREF_COOKIE_NAME,
  decodePreferenceCookie,
  encodePreferenceCookie,
  survivesLogout,
} from '@/constants/preference-cookie'

/**
 * Next.js 16 Proxy (formerly Middleware) — an OPTIMISTIC auth gate.
 *
 * It only checks for the presence of the better-auth session cookie
 * (`better-auth.session_token`) and redirects unauthenticated requests off
 * protected pages before they render (no client flash). It deliberately does
 * NOT validate the session — that's the client's job via useSession, and the
 * authoritative check is enforced by io2p-core on every API call. Per Next's
 * guidance, Proxy is for optimistic redirects only, never full authz.
 *
 * Cookie visibility: the issuer sets a host-only cookie, shared across ports on
 * `localhost` in dev (so this works locally today). In production across
 * subdomains, io2p-auth must set a cross-subdomain cookie domain for this gate
 * to see the cookie — otherwise it safely no-ops (the client guard still runs).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PAGES_SET.has(pathname)) {
    return NextResponse.next()
  }

  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const response = NextResponse.redirect(url)
    // The mirror is not HttpOnly and outlives the session, so a browser reopened
    // days later would paint the previous person's theme and views before any JS
    // could clear it. The LANGUAGE is kept — see `survivesLogout`. Scoped to this
    // redirect only; on the pass-through path the cookie is what we want intact.
    const kept = survivesLogout(
      decodePreferenceCookie(request.cookies.get(PREF_COOKIE_NAME)?.value)
    )
    if (kept.locale) {
      response.cookies.set(PREF_COOKIE_NAME, encodePreferenceCookie(kept), {
        path: '/',
      })
    } else {
      response.cookies.delete(PREF_COOKIE_NAME)
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except API routes, Next internals, the Sentry tunnel,
  // and static files (anything with a dot, e.g. .png/.ico).
  matcher: [
    '/((?!api|_next/static|_next/image|monitoring|favicon.ico|.*\\.).*)',
  ],
}
