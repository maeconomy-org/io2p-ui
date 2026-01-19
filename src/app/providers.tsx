'use client'

import { PropsWithChildren, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useStoreInitializer } from '@/stores'

/**
 * New simplified providers using Zustand
 * No more provider hell - just React Query and store initialization
 */
export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <StoreInitializer>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </StoreInitializer>
    </QueryClientProvider>
  )
}

/**
 * Component to initialize stores
 */
function StoreInitializer({ children }: PropsWithChildren) {
  useStoreInitializer()
  return <>{children}</>
}
