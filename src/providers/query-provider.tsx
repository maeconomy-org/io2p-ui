'use client'

import {
  createContext,
  useContext,
  PropsWithChildren,
  useState,
  useEffect,
} from 'react'
import { createClient } from 'iom-sdk'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { API_CONFIG } from '@/lib/api-config'

// Global singleton cache
let cachedClientPromise: ReturnType<typeof createClient> | null = null

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

    // Use cached promise or start new one
    if (!cachedClientPromise) {
      cachedClientPromise = createClient(API_CONFIG)
    }

    if (isMounted) setClient(cachedClientPromise)

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
            cachedClientPromise = null
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
