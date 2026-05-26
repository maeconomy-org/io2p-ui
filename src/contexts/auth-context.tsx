'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthResponse as BaseAuthResponse, Client } from 'iom-sdk'
import { PUBLIC_PAGES_SET } from '@/constants'
import { clearLegacyDrafts } from '@/components/object-sheets/hooks/use-object-drafts'

export interface CertificateInfo {
  certificateSha256?: string
  issuerFields?: Record<string, string>
  subjectFields?: Record<string, string>
  serialNumber?: string
  subjectAlternativeNames?: string[]
  validFrom?: string
  validTo?: string
}

export type AuthResponse = BaseAuthResponse & {
  certificateInfo?: CertificateInfo
}

interface AuthContextType {
  isAuthenticated: boolean
  authLoading: boolean
  isRefreshing: boolean
  userUUID: string | undefined
  userInfo: AuthResponse | null
  logout: () => void
  handleAuth: () => Promise<{ success: boolean; error?: string }>
  handleEmailLogin: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  authLoading: true,
  isRefreshing: false,
  userUUID: undefined,
  userInfo: null,
  logout: () => {},
  handleAuth: async () => ({ success: false }),
  handleEmailLogin: async () => ({ success: false }),
})

interface AuthProviderProps {
  children: ReactNode
  client: Client | null
}

export function AuthProvider({ children, client }: AuthProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [userInfo, setUserInfo] = useState<AuthResponse | null>(null)

  // Tracks the last observed authenticated user so we can detect identity
  // switches (e.g. user A logs out, user B auto-logs in with a browser-cached
  // certificate) and wipe the shared React Query cache before user B renders.
  const prevUserUUIDRef = useRef<string | undefined>(undefined)

  const handleAuthStateChange = useCallback(
    (state: {
      isAuthenticated: boolean
      isRefreshing: boolean
      user: AuthResponse | null
    }) => {
      const nextUUID = state.user?.userUUID
      const prevUUID = prevUserUUIDRef.current

      // Wipe the query cache on any identity transition: logout (had user,
      // now null) and user switch (had user A, now user B). Login from a
      // cold start (prev undefined → defined) is a no-op since there is
      // nothing cached yet.
      if (prevUUID && prevUUID !== nextUUID) {
        queryClient.clear()
      }
      prevUserUUIDRef.current = nextUUID

      setIsAuthenticated(state.isAuthenticated)
      setIsRefreshing(state.isRefreshing)
      setUserInfo(state.user)
      if (!state.isRefreshing) {
        setAuthLoading(false)
      }

      if (!state.isAuthenticated && !PUBLIC_PAGES_SET.has(pathname)) {
        router.replace('/')
      }
    },
    [pathname, router, queryClient]
  )

  useEffect(() => {
    if (!client) return

    let unsubscribe: (() => void) | undefined

    const init = async () => {
      unsubscribe = client.onAuthStateChange(handleAuthStateChange)

      await client.ready
      clearLegacyDrafts()
      setAuthLoading(false)
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [client, handleAuthStateChange])

  const logout = () => {
    if (!client) return
    // Clear cached server state immediately so the login screen (and any
    // briefly rendered protected page) can't show data from the previous
    // user. `handleAuthStateChange` also clears on identity transitions,
    // but doing it here guarantees the wipe happens synchronously even if
    // the SDK's state-change notification is delayed.
    queryClient.clear()
    router.push('/')
    client.logout()
  }

  const handleAuth = async () => {
    if (!client) {
      return { success: false, error: 'SDK client not initialized' }
    }

    const result = await client.login()

    if (result.success) {
      return { success: true }
    }

    return {
      success: false,
      error:
        'Authentication failed. Please ensure you have a valid certificate selected.',
    }
  }

  const handleEmailLogin = async (email: string, password: string) => {
    if (!client) {
      return { success: false, error: 'SDK client not initialized' }
    }

    const result = await client.loginWithEmailPassword({ email, password })

    if (result.success) {
      return { success: true }
    }

    return {
      success: false,
      error: 'Authentication failed. Please check your credentials.',
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authLoading,
        isRefreshing,
        userUUID: userInfo?.userUUID,
        userInfo,
        logout,
        handleAuth,
        handleEmailLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
