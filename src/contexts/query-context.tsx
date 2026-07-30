'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Client } from 'iom-sdk'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { ClientConfig } from '@/constants'
import { getSdkClient } from '@/lib/sdk-client'

// Dev-only, and lazy so the devtools bundle never enters the module graph of
// the provider that wraps every route.
const ReactQueryDevtools =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(
        () =>
          import('@tanstack/react-query-devtools').then(
            (m) => m.ReactQueryDevtools
          ),
        { ssr: false }
      )

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

interface QueryProviderProps {
  children: ReactNode
  /**
   * Built on the server from `process.env` and handed down, so config is known
   * before the first render on BOTH sides. Previously this provider awaited
   * `/api/config` in an effect and rendered a skeleton until it resolved, which
   * blocked every route's first paint on a client round trip.
   */
  config: ClientConfig
}

export function QueryProvider({ children, config }: QueryProviderProps) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Deliberately conservative: these apply to every hook that does NOT
            // set its own staleTime. The previous `Infinity` default meant any
            // such query was cached for the session and never refetched — safe
            // for the hooks that opted in explicitly, silently stale for the
            // ones that never thought about it.
            staleTime: 30_000,
            gcTime: 1000 * 60 * 10,
            // `true` means "refetch on mount IF STALE", not "always refetch" — fresh data still
            // comes from cache with no request. `false` broke invalidation across pages:
            // `invalidateQueries` marks an INACTIVE query stale but cannot refetch it, so creating
            // a template from /objects left /templates serving its cached list until a hard reload.
            // Every create or delete performed from another page had the same hole.
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    []
  )

  const client = useMemo(() => getSdkClient(config), [config])

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
