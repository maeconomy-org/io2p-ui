'use client'

import {
  createContext,
  useContext,
  PropsWithChildren,
  useState,
  useEffect,
} from 'react'
import { createClient } from 'iom-sdk'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { logger } from '@/lib/logger'
import { fetchClientConfig } from '@/constants'

// Global singleton cache
let cachedClient: ReturnType<typeof createClient> | null = null

const IomSdkClientContext = createContext<ReturnType<
  typeof createClient
> | null>(null)

export function useIomSdkClient() {
  const context = useContext(IomSdkClientContext)
  if (!context) {
    throw new Error(
      'useIomSdkClient must be used within an IomSdkClientProvider'
    )
  }
  return context
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(
    null
  )
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    // Fetch runtime config from API then create SDK client
    async function initClient() {
      // Return cached client if already initialized
      if (cachedClient) {
        if (isMounted) setClient(cachedClient)
        return
      }

      try {
        const config = await fetchClientConfig()

        // SDK debug: enabled in dev, disabled in prod
        const isDev = config.nodeEnv !== 'production'

        cachedClient = createClient({
          baseUrl: config.baseApiUrl,
          uuidServiceBaseUrl: config.uuidApiUrl,
          debug: {
            enabled: isDev,
            logLevel: isDev ? 'info' : 'error',
            logToConsole: isDev,
          },
        })

        if (isMounted) setClient(cachedClient)
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load config')
          )
        }
      }
    }

    initClient()

    return () => {
      isMounted = false
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-xl font-bold text-red-500">API Connection Error</p>
        <p>{error.message}</p>
        <button
          onClick={() => {
            cachedClient = null
            window.location.reload()
          }}
          className="px-4 py-2 bg-primary text-white rounded-md"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!client) {
    // Optionally: Replace with Suspense fallback
    return null // Or a subtle spinner
  }

  return (
    <IomSdkClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </IomSdkClientContext.Provider>
  )
}
