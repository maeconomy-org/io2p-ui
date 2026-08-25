'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  PUBLIC_PAGES_SET,
  clearPreferenceMirrors,
  getCachedConfig,
  type SocialProviderId,
} from '@/constants'
import { clearLegacyDrafts } from '@/hooks/drafts/use-object-drafts'
import { authClient, clearCoreToken, useSession } from '@/lib/auth/client'
import { useIomClient } from '@/lib/io2p'
import { logger } from '@/lib/observability/logger'
import { queryKeys } from '@/lib/query-keys'

export interface CertificateInfo {
  certificateSha256?: string
  issuerFields?: Record<string, string>
  subjectFields?: Record<string, string>
  serialNumber?: string
  subjectAlternativeNames?: string[]
  validFrom?: string
  validTo?: string
}

// Personal account details, surfaced from the auth session. The OPERATIONAL id
// (core userUUID) is exposed separately as useAuth().id — not part of this bag.
// Field mapping is intentionally minimal and will be refined as consumers
// migrate; certificateInfo comes from the issuer's /mtls/credential (deferred).
export interface AuthResponse {
  username?: string
  email?: string
  emailVerified?: boolean
  identifier?: string
  identifierType?: string
  credentials?: string
  credentialValue?: string
  createdAt?: string
  certificateInfo?: CertificateInfo
}

// Minimal shape of the better-auth session user we rely on.
interface SessionUser {
  id: string
  email?: string | null
  emailVerified?: boolean | null
  name?: string | null
  createdAt?: string | Date | null
}

function mapAccount(user: SessionUser): AuthResponse {
  const email = user.email ?? undefined
  return {
    // The auth session's `name` — shown as-is; no email fallback so the
    // Username row only appears when the account actually has a name.
    username: user.name ?? undefined,
    email,
    emailVerified: user.emailVerified ?? undefined,
    identifier: email,
    // TODO: derive from the last-used login method (cert vs email) once the
    // issuer's lastLoginMethod plugin is wired. Until then, treat as UP.
    identifierType: 'UserAuthUP',
    createdAt: user.createdAt
      ? new Date(user.createdAt).toISOString()
      : undefined,
  }
}

/**
 * Set for the gap between "the user clicked log out" and "the session is gone".
 *
 * Module scope rather than a ref, because `useAuth` is a plain hook every
 * consumer calls independently — a ref inside it would be one flag per caller,
 * and the one that matters is whichever instance owns the `/me` query.
 * `AuthEffects` clears it once the session has actually resolved to nobody.
 */
let signingOut = false

/**
 * The single user hook. Combines the two identity sources:
 *  - the better-auth session (personal account: name/email/cert) → `account`
 *  - io2p-core `/v1/me` (operational identity) → `id` (the core userUUID used
 *    everywhere: ownership, shares, scoping). Fetched inline here so there's
 *    ONE user hook; the /me query is cached app-wide under `users.current`.
 * New code should prefer better-auth's `useSession`/`authClient` directly.
 */
export function useAuth() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const iom = useIomClient()

  const { data: session, isPending } = useSession()
  const sessionUser = (session?.user as SessionUser | undefined) ?? null
  const isAuthenticated = !!sessionUser

  // Strictly ADDITIVE to the old `enabled: isAuthenticated`: it never removes a
  // fetch, it only starts one earlier. `users.me()` needs a core token, which
  // needs the session *cookie* — not the resolved session *object*. On a
  // protected route the proxy already guaranteed that cookie exists, so firing
  // while the session is still pending runs /me in PARALLEL with it instead of
  // after it, removing a serial round trip from every protected page load.
  const onProtectedRoute = !PUBLIC_PAGES_SET.has(pathname)
  const { data: coreUser, isPending: mePending } = useQuery({
    queryKey: queryKeys.users.current,
    // `signal` is not optional here: `useAuth()` mounts an observer in every
    // component that calls it, and a navigation unmounts them mid-flight. Without
    // it the fetch — and the core-token mint underneath it — outlive the page and
    // reject as an unhandled "Failed to fetch", which is what `cancelQueries()` in
    // `logout` was already trying to prevent.
    queryFn: ({ signal }) => iom.users.me({ signal }),
    // `!signingOut` is what stops the logout 401. `queryClient.clear()` removes
    // the cached user, and React Query immediately REFETCHES for any observer
    // still mounted and enabled — so `/me` fired against a session the issuer
    // was already tearing down, and the failed token mint surfaced as a console
    // error on every logout.
    enabled:
      !signingOut && (isAuthenticated || (isPending && onProtectedRoute)),
    staleTime: Infinity,
  })

  const logout = async () => {
    // Clear cached server state synchronously so the login screen can't flash
    // the previous user's data, then sign out at the issuer.
    signingOut = true
    // `clear()` drops the DATA but leaves observers subscribed, so every mounted
    // query on the page refetches against the session being torn down. Cancelling
    // first, and leaving via a full document load rather than `router.push`, means
    // there is nothing mounted to refetch — the `signingOut` guard only ever
    // covered `/me`, and each new protected query would need its own.
    await queryClient.cancelQueries()
    clearCoreToken()
    queryClient.clear()
    clearPreferenceMirrors()
    try {
      await authClient.signOut()
    } catch (err) {
      logger.warn('logout_signout_failed', { err })
    }
    window.location.assign('/')
  }

  const handleEmailLogin = async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      return {
        success: false,
        error:
          error.message ||
          'Authentication failed. Please check your credentials.',
      }
    }
    return { success: true }
  }

  // Resolves ONLY on failure. The success path is a full-page redirect to the
  // provider, so a caller must not clear its loading state in a `finally`.
  const handleSocialLogin = async (provider: SocialProviderId) => {
    try {
      // ABSOLUTE, both of them. better-auth stores these verbatim in the OAuth
      // state and emits them verbatim as the callback's Location header — it
      // never prefixes an origin. A relative path therefore resolves against
      // whoever issues the redirect, which is the ISSUER (:8081), not the app:
      // '/objects' became http://localhost:8081/objects and 404'd on Fastify.
      const returnTo = window.location.origin
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: `${returnTo}/objects`,
        errorCallbackURL: `${returnTo}/`,
      })
      if (error) {
        return {
          success: false,
          error: error.message || 'Authentication failed.',
        }
      }
      return { success: true }
    } catch (err) {
      logger.error('social_login_failed', { err, provider })
      return { success: false, error: 'Authentication failed.' }
    }
  }

  const handleAuth = async () => {
    // mTLS certificate login via the issuer's custom endpoint. The full
    // cross-origin cert handshake + cookie handoff (mtls-auth.<host>) is a
    // co-dev item with the issuer/nginx; this wires the call and refreshes the
    // session store on success.
    try {
      const base = getCachedConfig()?.authBaseUrl ?? ''
      const res = await fetch(`${base}/api/auth/mtls/login`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        return {
          success: false,
          error:
            'Certificate authentication failed. Ensure a valid client certificate is selected.',
        }
      }
      await authClient.getSession()
      return { success: true }
    } catch {
      return { success: false, error: 'Certificate authentication failed.' }
    }
  }

  // Deliberately NOT memoized. Every consumer destructures a primitive
  // (`userId`, `userInfo`, `authLoading`) or calls a handler from an event —
  // none put the bag or the handlers in a dependency array. Memoizing would buy
  // nothing and cost a hand-maintained dep list, which is a stale-closure risk
  // while `react-hooks/exhaustive-deps` is off. The React Compiler does this
  // correctly and automatically once it's enabled.
  return {
    isAuthenticated,
    // Auth is "ready" only once BOTH the session and the core identity resolve,
    // so consumers never see an authenticated user without an `id`.
    authLoading: isPending || (isAuthenticated && mePending),
    isRefreshing: false,
    // The core user id (io2p-core /me.id) — the operational id used everywhere.
    userId: coreUser?.id,
    // Server-stored UI preferences, already on this response — no second
    // request. `usePreference` reads them from here and writes through
    // `users.updatePreferences`.
    preferences: coreUser?.preferences,
    // Personal account details from the auth session.
    userInfo: sessionUser ? mapAccount(sessionUser) : null,
    logout,
    handleAuth,
    handleEmailLogin,
    handleSocialLogin,
  }
}

/**
 * Mounts the app-level auth side effects exactly once (renders nothing):
 *  - wipes the React Query cache on any identity transition (logout / switch),
 *    keyed on the instant session id (not the lagging core id)
 *  - client-side route protection for non-public pages
 *  - clears legacy local drafts after the first resolved session
 * Kept out of useAuth so these fire once, not per-consumer.
 */
export function AuthEffects() {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  const { data: session, isPending } = useSession()
  const sessionUserId = (session?.user as SessionUser | undefined)?.id
  const isAuthenticated = !!sessionUserId

  const prevUserIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const prev = prevUserIdRef.current
    if (prev && prev !== sessionUserId) {
      clearCoreToken()
      queryClient.clear()
      // Also covers a USER SWITCH and a session EXPIRY, neither of which goes
      // through `logout()`. Both are the shared-machine case: without this the
      // next person's first paint is the previous person's theme and views.
      clearPreferenceMirrors()
    }
    prevUserIdRef.current = sessionUserId
    // The teardown is over the moment the session resolves to nobody. Leaving
    // the flag set would keep `/me` disabled for the NEXT sign-in on this tab.
    if (!isPending && !sessionUserId) signingOut = false
  }, [sessionUserId, isPending, queryClient])

  const clearedDraftsRef = useRef(false)
  useEffect(() => {
    if (!isPending && !clearedDraftsRef.current) {
      clearedDraftsRef.current = true
      clearLegacyDrafts()
    }
  }, [isPending])

  useEffect(() => {
    if (isPending) return
    if (!isAuthenticated && !PUBLIC_PAGES_SET.has(pathname)) {
      router.replace('/')
    }
  }, [isPending, isAuthenticated, pathname, router])

  return null
}
