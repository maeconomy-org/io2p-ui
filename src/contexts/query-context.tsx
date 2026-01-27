'use client'

import {
  createContext,
  useContext,
  PropsWithChildren,
  useState,
  useEffect,
  useMemo,
} from 'react'
import type { Client } from 'iom-sdk'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchClientConfig, ClientConfig } from '@/constants'
import { getSdkClient } from '@/lib/sdk-client'

const IomSdkClientContext = createContext<Client | null>(null)
const ConfigContext = createContext<ClientConfig | null>(null)

export function useIomSdkClient(): Client {
  const context = useContext(IomSdkClientContext)
  if (!context) {
    throw new Error(
      'useIomSdkClient must be used within a QueryProvider and client must be ready'
    )
  }
  return context
}

export function useAppConfig(): ClientConfig {
  const context = useContext(ConfigContext)
  if (!context) {
    throw new Error('useAppConfig must be used within a QueryProvider')
  }
  return context
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [client, setClient] = useState<Client | null>(null)
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 1000 * 60 * 10,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
    []
  )

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const sdk = await getSdkClient()
        const fetchedConfig = await fetchClientConfig()

        if (mounted) {
          setClient(sdk)
          setConfig(fetchedConfig)
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to initialize SDK client')
          )
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-xl font-bold text-red-500">API Connection Error</p>
        <p>{error.message}</p>
        <button
          onClick={() => {
            window.location.reload()
          }}
          className="px-4 py-2 bg-primary text-white rounded-md"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!client || !config) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <ConfigContext.Provider value={config}>
      <IomSdkClientContext.Provider value={client}>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </IomSdkClientContext.Provider>
    </ConfigContext.Provider>
  )
}
