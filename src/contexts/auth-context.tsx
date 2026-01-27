'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { AuthResponse, Client } from 'iom-sdk'

interface AuthContextType {
  isAuthenticated: boolean
  authLoading: boolean
  isRefreshing: boolean
  userUUID: string | undefined
  userInfo: AuthResponse | null
  logout: () => void
  handleAuth: () => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  authLoading: true,
  isRefreshing: false,
  userUUID: undefined,
  userInfo: null,
  logout: () => {},
  handleAuth: async () => ({ success: false }),
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

  const publicPages = useMemo(
    () => new Set(['/', '/help', '/terms', '/privacy']),
    []
  )

  useEffect(() => {
    if (!client) return

    let unsubscribe: (() => void) | undefined

    const init = async () => {
      // Wait for SDK startup refresh
      await client.ready

      unsubscribe = client.onAuthStateChange((state) => {
        setIsAuthenticated(state.isAuthenticated)
        setIsRefreshing(state.isRefreshing)
        setUserInfo(state.user)
        setAuthLoading(false)

        const isPublicPage = publicPages.has(pathname)

        // Only redirect if truly logged out
        if (!state.isAuthenticated && !isPublicPage) {
          router.replace('/')
        }
      })
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [client, pathname, publicPages, router])

  const logout = () => {
    if (!client) return
    client.logout()
    router.push('/')
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
