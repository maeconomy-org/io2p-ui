'use client'

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

// One client PER ORIGIN, not per component. `useMemo` is per component
// instance, so the previous version built a fresh Io2pClient in every hook that
// called this — and createEntityHooks calls it in all six of
// useList/useGet/useCreate/useUpdate/useRemove/useRestore, so a single list page
// stood up four or more. Keyed by baseUrl, this still honours "one client per
// node" (the old SDK's module-singleton trap was a single client for ALL nodes).
const clientsByOrigin = new Map<string, Io2pClient>()

/**
 * The io2p-client seam every migrated data hook consumes — distinct from the
 * dormant `useIomSdkClient` (old iom-sdk) that un-migrated hooks still use.
 */
export function useIomClient(): Io2pClient {
  const baseUrl = getCachedConfig()?.coreBaseUrl ?? ''
  let client = clientsByOrigin.get(baseUrl)
  if (!client) {
    client = createIo2pClient(baseUrl)
    clientsByOrigin.set(baseUrl, client)
  }
  return client
}
