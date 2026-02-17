'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
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

  useEffect(() => {
    if (!client) return

    let unsubscribe: (() => void) | undefined

    const init = async () => {
      // Subscribe immediately to get initial state from SDK (including cached values)
      unsubscribe = client.onAuthStateChange((state) => {
        setIsAuthenticated(state.isAuthenticated)
        setIsRefreshing(state.isRefreshing)
        setUserInfo(state.user)

        // Only hide loading if we are not currently refreshing tokens
        if (!state.isRefreshing) {
          setAuthLoading(false)
        }

        // Only redirect if truly logged out and on a private page
        if (!state.isAuthenticated && !PUBLIC_PAGES_SET.has(pathname)) {
          router.replace('/')
        }
      })

      // Wait for SDK startup refresh to complete, then ensure loading is finished
      await client.ready
      setAuthLoading(false)
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [client, pathname, router])

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

    // TODO: Implement email/password login when API is ready
    // const result = await client.loginWithEmail(email, password)
    // For now, return a placeholder response
    return {
      success: false,
      error: 'Email/password authentication not yet implemented',
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
