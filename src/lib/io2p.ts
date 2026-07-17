'use client'

import { useMemo } from 'react'
import { createClient, type Io2pClient } from 'io2p-client'

import { getCachedConfig } from '@/constants/client'

import { getCoreToken } from './auth-client'

/**
 * Build an io2p-client bound to a storage-node origin. The SDK is auth-agnostic
 * — it takes a single `getToken` dependency and owns retry/pagination/errors.
 * One client per node (never a module singleton — the old SDK's trap).
 */
export function createIo2pClient(baseUrl: string): Io2pClient {
  // Inject a BOUND fetch. The SDK calls its raw fetch as `transport.fetch(url)` for the direct-to-S3
  // PUT (upload orchestrator); an unbound native `fetch` invoked as a method throws "Illegal
  // invocation" (its `this` must be the global). Binding once here keeps every path safe.
  return createClient({
    baseUrl,
    getToken: getCoreToken,
    fetch: globalThis.fetch.bind(globalThis),
  })
}

/**
 * The io2p-client seam every migrated data hook consumes — distinct from the
 * dormant `useIomSdkClient` (old iom-sdk) that un-migrated hooks still use.
 * Memoized on the core origin from runtime config.
 */
export function useIomClient(): Io2pClient {
  const baseUrl = getCachedConfig()?.coreBaseUrl ?? ''
  return useMemo(() => createIo2pClient(baseUrl), [baseUrl])
}
