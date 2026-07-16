'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { PUBLIC_PAGES_SET, getCachedConfig } from '@/constants'
import { clearLegacyDrafts } from '@/components/object-sheets/hooks/use-object-drafts'
import { authClient, useSession } from '@/lib/auth-client'
import { useIomClient } from '@/lib/io2p'
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
 * The single user hook. Combines the two identity sources:
 *  - the better-auth session (personal account: name/email/cert) → `account`
 *  - io2p-core `/v1/me` (operational identity) → `id` (the core userUUID used
 *    everywhere: ownership, shares, scoping). Fetched inline here so there's
 *    ONE user hook; the /me query is cached app-wide under `users.current`.
 * New code should prefer better-auth's `useSession`/`authClient` directly.
 */
export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const iom = useIomClient()

  const { data: session, isPending } = useSession()
  const sessionUser = (session?.user as SessionUser | undefined) ?? null
  const isAuthenticated = !!sessionUser

  // Primary post-login query — fires as soon as a session exists.
  const { data: coreUser, isPending: mePending } = useQuery({
    queryKey: queryKeys.users.current,
    queryFn: () => iom.users.me(),
    enabled: isAuthenticated,
    staleTime: Infinity,
  })

  const logout = () => {
    // Clear cached server state synchronously so the login screen can't flash
    // the previous user's data, then sign out at the issuer.
    queryClient.clear()
    router.push('/')
    void authClient.signOut()
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

  return {
    isAuthenticated,
    // Auth is "ready" only once BOTH the session and the core identity resolve,
    // so consumers never see an authenticated user without an `id`.
    authLoading: isPending || (isAuthenticated && mePending),
    isRefreshing: false,
    // The core user id (io2p-core /me.id) — the operational id used everywhere.
    userId: coreUser?.id,
    // Personal account details from the auth session.
    userInfo: sessionUser ? mapAccount(sessionUser) : null,
    logout,
    handleAuth,
    handleEmailLogin,
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
      queryClient.clear()
    }
    prevUserIdRef.current = sessionUserId
  }, [sessionUserId, queryClient])

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
