import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import { PUBLIC_PAGES_SET } from '@/constants/auth'

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
    return NextResponse.redirect(url)
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
