import { createStoreWithDevtools } from './utils/store-utils'
import { useSDKStore } from './sdk-store'
import { logger } from '@/lib/logger'

// User info type from JWT payload
export interface UserInfo {
  userUUID: string
  credentials?: string
  authorities: string[]
  enabled: boolean
  accountNonExpired?: boolean
  credentialsNonExpired?: boolean
  accountNonLocked?: boolean
  expiresAt: Date
  issuedAt: Date
}

export interface AuthState {
  // State
  userInfo: UserInfo | null
  isAuthenticated: boolean
  isLoggingIn: boolean
  isLoggingOut: boolean
  loginError: string | null

  // Actions
  login: () => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuthStatus: () => boolean
  loadUserInfo: () => Promise<void>
  setUserInfo: (userInfo: UserInfo | null) => void
  clearError: () => void
}

export const useAuthStore = createStoreWithDevtools<AuthState>(
  (set, get) => ({
    // Initial state
    userInfo: null,
    isAuthenticated: false,
    isLoggingIn: false,
    isLoggingOut: false,
    loginError: null,

    // User-initiated login function
    login: async () => {
      const state = get()

      if (state.isLoggingIn) {
        return { success: false, error: 'Login already in progress' }
      }

      set((state) => ({
        ...state,
        isLoggingIn: true,
        loginError: null,
      }))

      try {
        const client = useSDKStore.getState().client

        if (!client) {
          throw new Error('SDK client not initialized')
        }

        logger.debug('Initiating user login...')

        const result = await client.login()

        if (result.success) {
          const payload = client.decodeTokenPayload(result.token)
          const userInfoData: UserInfo = {
            userUUID: payload?.userUUID || '',
            credentials: payload?.credentials,
            authorities: payload?.authorities || [],
            enabled: payload?.enabled || false,
            accountNonExpired: payload?.accountNonExpired,
            credentialsNonExpired: payload?.credentialsNonExpired,
            accountNonLocked: payload?.accountNonLocked,
            expiresAt: new Date((payload?.exp || 0) * 1000),
            issuedAt: new Date((payload?.iat || 0) * 1000),
          }

          set((state) => ({
            ...state,
            userInfo: userInfoData,
            isAuthenticated: true,
            isLoggingIn: false,
            loginError: null,
          }))

          logger.debug('User login successful')
          return { success: true }
        }

        set((state) => ({
          ...state,
          isLoggingIn: false,
          loginError: 'Authentication failed',
        }))

        return { success: false, error: 'Authentication failed' }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown login error'

        logger.error('Login error:', error)

        set((state) => ({
          ...state,
          isLoggingIn: false,
          loginError: errorMessage,
        }))

        return { success: false, error: errorMessage }
      }
    },

    // User-initiated logout function
    logout: async () => {
      const state = get()

      if (state.isLoggingOut) {
        return
      }

      set((state) => ({
        ...state,
        isLoggingOut: true,
      }))

      try {
        const client = useSDKStore.getState().client

        if (client) {
          await client.logout()
        }

        set((state) => ({
          ...state,
          userInfo: null,
          isAuthenticated: false,
          isLoggingOut: false,
          loginError: null,
        }))

        logger.debug('User logout successful')
      } catch (error) {
        logger.error('Logout error:', error)

        set((state) => ({
          ...state,
          userInfo: null,
          isAuthenticated: false,
          isLoggingOut: false,
        }))
      }
    },

    // Check auth status
    checkAuthStatus: () => {
      const client = useSDKStore.getState().client
      return client ? client.isAuthenticated() : false
    },

    // Load user info from JWT token
    loadUserInfo: async () => {
      try {
        const client = useSDKStore.getState().client

        if (!client || !client.isAuthenticated()) {
          set((state) => ({
            ...state,
            userInfo: null,
            isAuthenticated: false,
          }))
          return
        }

        const tokenInfo = await client.getToken()
        if (tokenInfo) {
          const payload = client.decodeTokenPayload(tokenInfo.token)
          const userInfoData: UserInfo = {
            userUUID: payload?.userUUID || '',
            credentials: payload?.credentials,
            authorities: payload?.authorities || [],
            enabled: payload?.enabled || false,
            accountNonExpired: payload?.accountNonExpired,
            credentialsNonExpired: payload?.credentialsNonExpired,
            accountNonLocked: payload?.accountNonLocked,
            expiresAt: new Date((payload?.exp || 0) * 1000),
            issuedAt: new Date((payload?.iat || 0) * 1000),
          }

          set((state) => ({
            ...state,
            userInfo: userInfoData,
            isAuthenticated: true,
          }))
        }
      } catch (error) {
        logger.error('Failed to load user info:', error)

        set((state) => ({
          ...state,
          userInfo: null,
          isAuthenticated: false,
        }))
      }
    },

    // Set user info directly
    setUserInfo: (userInfo) => {
      set((state) => ({
        ...state,
        userInfo,
        isAuthenticated: !!userInfo,
      }))
    },

    // Clear login error
    clearError: () => {
      set((state) => ({
        ...state,
        loginError: null,
      }))
    },
  }),
  {
    name: 'auth-store',
    persist: {
      key: 'iom-auth-state',
      partialize: (state) => ({
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  }
)

// Selectors for performance optimization
export const authSelectors = {
  userInfo: (state: AuthState) => state.userInfo,
  isAuthenticated: (state: AuthState) => state.isAuthenticated,
  isLoggingIn: (state: AuthState) => state.isLoggingIn,
  isLoggingOut: (state: AuthState) => state.isLoggingOut,
  loginError: (state: AuthState) => state.loginError,
  userUUID: (state: AuthState) => state.userInfo?.userUUID,
  authorities: (state: AuthState) => state.userInfo?.authorities || [],
  isTokenExpired: (state: AuthState) =>
    state.userInfo ? state.userInfo.expiresAt < new Date() : false,
}
