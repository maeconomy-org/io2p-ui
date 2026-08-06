'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import type { ClientConfig } from '@/constants'
import { isCallerAbort, wasErrorReported } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'

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

const ConfigContext = createContext<ClientConfig | null>(null)

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
        // Global error handlers: every failed query/mutation not hand-caught
        // by a component used to disappear silently (and `retry: 1` meant it
        // cost two requests before doing so). Logging ONLY — toasts stay a
        // per-hook decision, or every background refetch failure becomes a
        // popup.
        //
        // These are a SAFETY NET, not the primary record. Anything that went
        // through io2p-client was already logged at error level by the SDK's
        // own onError hook, with method/path/status/duration — richer than a
        // query key. Logging it again would double the shipped records and
        // the Sentry captures for a single failure, so a reported error is
        // skipped here and only the un-reported ones (a raw fetch in a
        // queryFn, a throw inside a select) produce a record.
        //
        // The abort guard is defensive: TanStack v5 handles its own unmount
        // cancellations internally and cancelled queries revert rather than
        // error, so this should not fire on the standard path — but an
        // AbortError that DID reach here would otherwise be re-inflated to
        // error level after io2p.ts deliberately demoted it.
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (isCallerAbort(error) || wasErrorReported(error)) return
            logger.error('Query failed', {
              err: error,
              queryKey: query.queryKey,
            })
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (isCallerAbort(error) || wasErrorReported(error)) return
            logger.error('Mutation failed', {
              err: error,
              mutationKey: mutation.options.mutationKey,
            })
          },
        }),
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

  return (
    <ConfigContext.Provider value={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}
