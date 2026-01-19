'use client'

import { useEffect } from 'react'
import {
  useSDKStore,
  useAuthStore,
  useUIStore,
  subscribeToStore,
} from '@/stores'
import { logger } from '@/lib/logger'

import type { AuthState } from './auth-store'
import type { SDKState } from './sdk-store'

/**
 * Initialize all stores and set up cross-store subscriptions
 * This should be called once at the app root level
 */
export function useStoreInitializer() {
  const initializeSDK = useSDKStore((state) => state.initializeClient)
  const loadUserInfo = useAuthStore((state) => state.loadUserInfo)
  const setTheme = useUIStore((state) => state.setTheme)

  useEffect(() => {
    // Initialize SDK client on app start
    initializeSDK()

    // Initialize theme from system preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('iom-ui-theme') as
        | 'light'
        | 'dark'
        | 'system'
      if (savedTheme) {
        setTheme(savedTheme)
      }
    }

    logger.debug('Stores initialized')
  }, [initializeSDK, setTheme])

  useEffect(() => {
    // Set up cross-store subscriptions
    const unsubscribers: Array<() => void> = []

    // When SDK client is initialized, check auth status
    unsubscribers.push(
      subscribeToStore(
        useSDKStore,
        (state: SDKState) => state.isInitialized,
        (isInitialized) => {
          if (isInitialized) {
            logger.debug('SDK initialized, checking auth status')
            loadUserInfo()
          }
        }
      )
    )

    // When auth status changes, update localStorage token sync
    unsubscribers.push(
      subscribeToStore(
        useAuthStore,
        (state: AuthState) => state.isAuthenticated,
        (isAuthenticated, wasAuthenticated) => {
          if (isAuthenticated !== wasAuthenticated) {
            logger.debug('Auth status changed:', { isAuthenticated })

            // Trigger storage event for cross-tab synchronization
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new StorageEvent('storage', {
                  key: 'iom-sdk-jwt-token',
                  newValue: isAuthenticated ? 'authenticated' : null,
                })
              )
            }
          }
        }
      )
    )

    // Listen for storage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'iom-sdk-jwt-token') {
        logger.debug('Token change detected from another tab')
        loadUserInfo()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      unsubscribers.push(() => {
        window.removeEventListener('storage', handleStorageChange)
      })
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [loadUserInfo])
}

/**
 * Hook to get all store states for debugging
 */
export function useStoreDebugger() {
  const sdkState = useSDKStore()
  const authState = useAuthStore()
  const uiState = useUIStore()

  return {
    sdk: sdkState,
    auth: authState,
    ui: uiState,
  }
}
