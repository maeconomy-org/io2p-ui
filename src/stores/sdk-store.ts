import { createClient } from 'iom-sdk'
import type { IOBClient, SDKError } from 'iom-sdk'
import { createStoreWithDevtools } from './utils/store-utils'
import { fetchClientConfig } from '@/constants'
import { logger } from '@/lib/logger'

export interface SDKState {
  // State
  client: IOBClient | null
  isInitialized: boolean
  isInitializing: boolean
  error: Error | null
  config: any | null

  // Actions
  initializeClient: () => Promise<void>
  resetClient: () => void
  setError: (error: Error | null) => void
}

// Global singleton cache
let cachedClient: IOBClient | null = null

export const useSDKStore = createStoreWithDevtools<SDKState>(
  (set, get) => ({
    // Initial state
    client: null,
    isInitialized: false,
    isInitializing: false,
    error: null,
    config: null,

    // Initialize SDK client with global error handlers
    initializeClient: async () => {
      const state = get()

      if (state.isInitializing || state.isInitialized) {
        return
      }

      if (cachedClient) {
        set((state: SDKState) => ({
          ...state,
          client: cachedClient,
          isInitialized: true,
          error: null,
        }))
        return
      }

      set((state: SDKState) => ({
        ...state,
        isInitializing: true,
        error: null,
      }))

      try {
        logger.debug('Initializing SDK client...')

        const config = await fetchClientConfig()
        const isDev = config.nodeEnv !== 'production'

        const client = createClient({
          auth: { baseUrl: config.authApiUrl },
          registry: { baseUrl: config.registryApiUrl },
          node: { baseUrl: config.nodeApiUrl },
          tokenStorage: 'localStorage',
          errorHandling: {
            debug: isDev,
            autoRetryAuth: true,
            autoRetryNetwork: {
              maxRetries: 3,
              delay: 1000,
              backoff: 'exponential',
            },

            // Global authentication error handler
            onAuthError: (error: SDKError) => {
              logger.security('SDK Authentication Error', {
                service: error.service,
                status: error.status,
                message: error.message,
                context: error.context,
              })

              // Force logout on auth errors
              // Note: We'll handle this in the component that catches the error
              console.warn(
                'Authentication error detected - user should be logged out'
              )
            },

            // Global network error handler
            onNetworkError: (error: SDKError) => {
              logger.error('SDK Network Error', {
                service: error.service,
                status: error.status,
                message: error.message,
                context: error.context,
              })

              // Could show toast notification for network errors
              if (typeof window !== 'undefined') {
                // Only in browser environment
                import('sonner').then(({ toast }) => {
                  toast.error('Network Error', {
                    description: 'Please check your connection and try again',
                  })
                })
              }
            },

            // Global service error handler
            onServiceError: (error: SDKError, service: string) => {
              logger.error(`SDK ${service} Service Error`, {
                service: error.service,
                status: error.status,
                message: error.message,
                context: error.context,
                details: error.details,
              })

              // Handle specific service errors
              if (error.status === 403) {
                logger.security('Access Denied', {
                  service,
                  context: error.context,
                })
              }
            },
          },
        })

        cachedClient = client

        set((state: SDKState) => ({
          ...state,
          client,
          config,
          isInitialized: true,
          isInitializing: false,
          error: null,
        }))

        logger.debug(
          'SDK client initialized successfully with global error handlers'
        )
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error('Failed to initialize SDK client')

        logger.error('SDK client initialization failed:', err)

        set((state: SDKState) => ({
          ...state,
          error: err,
          isInitializing: false,
          isInitialized: false,
        }))
      }
    },

    // Reset client
    resetClient: () => {
      cachedClient = null
      set((state: SDKState) => ({
        ...state,
        client: null,
        isInitialized: false,
        isInitializing: false,
        error: null,
        config: null,
      }))
    },

    // Set error state
    setError: (error) => {
      set((state: SDKState) => ({
        ...state,
        error,
      }))
    },
  }),
  {
    name: 'sdk-store',
  }
)

// Selectors for performance optimization
export const sdkSelectors = {
  client: (state: SDKState) => state.client,
  isInitialized: (state: SDKState) => state.isInitialized,
  isInitializing: (state: SDKState) => state.isInitializing,
  error: (state: SDKState) => state.error,
  config: (state: SDKState) => state.config,
}
