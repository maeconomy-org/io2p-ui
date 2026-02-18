'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { AuthResponse, Client } from 'iom-sdk'
import { PUBLIC_PAGES_SET } from '@/constants'

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

  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [userInfo, setUserInfo] = useState<AuthResponse | null>(null)

  const handleAuthStateChange = useCallback(
    (state: {
      isAuthenticated: boolean
      isRefreshing: boolean
      user: AuthResponse | null
    }) => {
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
    [pathname, router]
  )

  useEffect(() => {
    if (!client) return

    let unsubscribe: (() => void) | undefined

    const init = async () => {
      unsubscribe = client.onAuthStateChange(handleAuthStateChange)

      await client.ready
      setAuthLoading(false)
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [client, handleAuthStateChange])

  const logout = () => {
    if (!client) return
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
