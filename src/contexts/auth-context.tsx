'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AUTH_SESSION_KEY } from '@/constants'
import { useCommonApi } from '@/hooks/api'

// Auth data type
interface AuthData {
  authenticated: boolean
  timestamp: number
  certCommonName?: string
  certFingerprint?: string
  userUUID?: string
  certValidFrom?: string // Certificate validity start date
  certValidTo?: string // Certificate validity end date
  certSerialNumber?: string // Certificate serial number
}

// Auth context type
interface AuthContextType {
  isAuthenticated: boolean
  certCommonName: string | undefined
  certFingerprint: string | undefined
  userUUID: string | undefined
  certValidFrom: string | undefined
  certValidTo: string | undefined
  certSerialNumber: string | undefined
  login: (authData: AuthData) => void
  logout: () => void
  checkAuth: () => boolean
  handleCertificateAuth: () => Promise<{ success: boolean; error?: string }>
}

// Default auth context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  certCommonName: undefined,
  certFingerprint: undefined,
  userUUID: undefined,
  certValidFrom: undefined,
  certValidTo: undefined,
  certSerialNumber: undefined,
  login: () => {},
  logout: () => {},
  checkAuth: () => false,
  handleCertificateAuth: async () => ({ success: false }),
})

// Auth provider props
interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [certCommonName, setCertCommonName] = useState<string | undefined>(
    undefined
  )
  const [certFingerprint, setCertFingerprint] = useState<string | undefined>(
    undefined
  )
  const [userUUID, setUserUuid] = useState<string | undefined>(undefined)
  const [certValidFrom, setCertValidFrom] = useState<string | undefined>(
    undefined
  )
  const [certValidTo, setCertValidTo] = useState<string | undefined>(undefined)
  const [certSerialNumber, setCertSerialNumber] = useState<string | undefined>(
    undefined
  )

  // Get API hooks
  const { useRequestCertificate } = useCommonApi()
  const requestCertificate = useRequestCertificate()

  // Public pages that don't require authentication
  const publicPages = ['/', '/help', '/terms', '/privacy']
  const isPublicPage = publicPages.includes(pathname)

  // Check authentication status on mount
  useEffect(() => {
    const authenticated = checkAuth()

    // If not authenticated and not on a public page, redirect to login
    if (!authenticated && !isPublicPage) {
      router.push('/')
    }
  }, [pathname, router, isPublicPage])

  // Check authentication from session storage
  const checkAuth = (): boolean => {
    try {
      const authData = sessionStorage.getItem(AUTH_SESSION_KEY)
      if (authData) {
        const parsed = JSON.parse(authData) as AuthData
        if (parsed.authenticated && parsed.timestamp) {
          const authTime = new Date(parsed.timestamp)
          const now = new Date()
          // If authenticated within the 12 hours, consider it valid
          if (now.getTime() - authTime.getTime() < 12 * 60 * 60 * 1000) {
            setIsAuthenticated(true)
            setCertCommonName(parsed.certCommonName)
            setCertFingerprint(parsed.certFingerprint)
            setUserUuid(parsed.userUUID)
            setCertValidFrom(parsed.certValidFrom)
            setCertValidTo(parsed.certValidTo)
            setCertSerialNumber(parsed.certSerialNumber)
            return true
          }
        }
      }
    } catch (e) {
      // Auth status read error - silent fail for UX
    }

    setIsAuthenticated(false)
    setCertCommonName(undefined)
    setCertFingerprint(undefined)
    setUserUuid(undefined)
    setCertValidFrom(undefined)
    setCertValidTo(undefined)
    setCertSerialNumber(undefined)
    return false
  }

  // Login function
  const login = (authData: AuthData) => {
    // Store auth data in session storage
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authData))
    setIsAuthenticated(true)
    setCertCommonName(authData.certCommonName)
    setCertFingerprint(authData.certFingerprint)
    setUserUuid(authData.userUUID)
    setCertValidFrom(authData.certValidFrom)
    setCertValidTo(authData.certValidTo)
    setCertSerialNumber(authData.certSerialNumber)
  }

  // Logout function
  const logout = () => {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
    setIsAuthenticated(false)
    setCertCommonName(undefined)
    setCertFingerprint(undefined)
    setUserUuid(undefined)
    setCertValidFrom(undefined)
    setCertValidTo(undefined)
    setCertSerialNumber(undefined)
    router.push('/')
  }

  // Handle certificate authentication
  const handleCertificateAuth = async (): Promise<{
    success: boolean
    error?: string
  }> => {
    try {
      // Initiate auth flow
      const response = await requestCertificate.mutateAsync()

      // Validate both base and UUID auth responses
      const baseAuth = response.base
      const uuidAuth = response.uuid

      // Check if both requests were successful
      if (!baseAuth || !uuidAuth) {
        throw new Error('Authentication failed: Invalid response')
      }

      // Validate base authentication status and account validity
      if (!baseAuth.enabled) {
        throw new Error('Account is disabled')
      }
      if (!baseAuth.accountNonExpired) {
        throw new Error('Account has expired')
      }
      if (!baseAuth.credentialsNonExpired) {
        throw new Error('Credentials have expired')
      }
      if (!baseAuth.accountNonLocked) {
        throw new Error('Account is locked')
      }

      // Validate UUID authentication status and account validity
      if (!uuidAuth.enabled) {
        throw new Error('UUID service access is disabled')
      }
      if (!uuidAuth.accountNonExpired) {
        throw new Error('UUID service account has expired')
      }
      if (!uuidAuth.credentialsNonExpired) {
        throw new Error('UUID service credentials have expired')
      }
      if (!uuidAuth.accountNonLocked) {
        throw new Error('UUID service account is locked')
      }

      // Extract certificate information from base auth
      const certFingerprint = baseAuth.certificateInfo?.certificateSha256
      const certCommonName = baseAuth.certificateInfo?.subjectFields?.CN

      if (!certFingerprint || !certCommonName) {
        throw new Error('Invalid certificate information')
      }

      // Check certificate validity dates
      const now = new Date()
      const validFrom = new Date(baseAuth.certificateInfo.validFrom)
      const validTo = new Date(baseAuth.certificateInfo.validTo)

      if (now < validFrom) {
        throw new Error('Certificate is not yet valid')
      }
      if (now > validTo) {
        throw new Error('Certificate has expired')
      }

      // If we get here, both authentications are valid
      // Login using auth context
      login({
        authenticated: true,
        timestamp: Date.now(),
        certFingerprint,
        certCommonName,
        userUUID: baseAuth.userUUID,
        certValidFrom: baseAuth.certificateInfo.validFrom,
        certValidTo: baseAuth.certificateInfo.validTo,
        certSerialNumber: baseAuth.certificateInfo.serialNumber,
      })

      return { success: true }
    } catch (err) {
      // Authentication failed - error will be shown in UI

      // Provide specific error messages
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown authentication error'

      return {
        success: false,
        error: `Authentication failed: ${errorMessage}. Please ensure you have a valid, non-expired certificate.`,
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        certCommonName,
        certFingerprint,
        userUUID,
        certValidFrom,
        certValidTo,
        certSerialNumber,
        login,
        logout,
        checkAuth,
        handleCertificateAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
