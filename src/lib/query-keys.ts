/**
 * Centralized React Query key factory
 *
 * All query keys should be created through this factory to ensure
 * consistency, prevent collisions, and enable targeted invalidation.
 *
 * Pattern: each entity has a base key, with sub-keys for different
 * query variants. Mutations should invalidate the narrowest possible
 * scope using these keys.
 */

import type {
  ListTemplatesQuery,
  ListConstantsQuery,
  ListFormulasQuery,
  ListSharesQuery,
  ListFilesQuery,
  ListUsersQuery,
} from 'io2p-client'

export const queryKeys = {
  // ─── Objects ─────────────────────────────────────────────
  objects: {
    all: ['objects'] as const,
    lists: () => [...queryKeys.objects.all, 'list'] as const,
    list: (query?: unknown) => [...queryKeys.objects.lists(), query] as const,
    details: () => [...queryKeys.objects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.objects.details(), id] as const,
    children: (parentId: string, query?: unknown) =>
      [...queryKeys.objects.all, 'children', parentId, query] as const,
    subtree: (ancestorId: string, query?: unknown) =>
      [...queryKeys.objects.all, 'subtree', ancestorId, query] as const,
  },

  // ─── Processes ───────────────────────────────────────────
  processes: {
    all: ['processes'] as const,
    lists: () => [...queryKeys.processes.all, 'list'] as const,
    list: (query?: unknown) => [...queryKeys.processes.lists(), query] as const,
    details: () => [...queryKeys.processes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.processes.details(), id] as const,
    // The flow graph sweeps every page to get whole-graph topology, so it is not one of the
    // paginated lists — but it must still be invalidated by a write, hence living under `lists()`.
    graph: () => [...queryKeys.processes.lists(), 'graph'] as const,
  },

  // ─── Addresses ───────────────────────────────────────────
  addresses: {
    all: ['addresses'] as const,
    detail: (uuid: string) => [...queryKeys.addresses.all, uuid] as const,
  },

  // ─── Auth (better-auth session list) ─────────────────────
  auth: {
    sessions: ['auth', 'sessions'] as const,
  },

  // ─── Users ───────────────────────────────────────────────
  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    findByIdentifier: (identifier: string) =>
      ['users', 'findByIdentifier', identifier] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (query?: ListUsersQuery) =>
      [...queryKeys.users.lists(), query] as const,
  },

  // ─── Files (presigned URLs) ──────────────────────────────
  // Short-lived presigned URLs from the file-storage service. Stale time is
  // set on the hooks to refetch before backend TTL expiry.
  files: {
    all: ['files'] as const,
    // io2p on-demand signed url. `kind` is part of the key on purpose: preview is served
    // `Content-Disposition: inline`, download as `attachment` — one shared entry would let a
    // hover-prefetched preview satisfy a download click (the browser would render, not save).
    url: (id: string, kind: 'preview' | 'download', variant?: string) =>
      [...queryKeys.files.all, 'url', kind, id, variant ?? null] as const,
    lists: () => [...queryKeys.files.all, 'list'] as const,
    list: (query?: ListFilesQuery) =>
      [...queryKeys.files.lists(), query] as const,
    details: () => [...queryKeys.files.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.files.details(), id] as const,
  },

  // ─── Formulas (io2p-client leaf resource) ────────────────
  formulas: {
    all: ['formulas'] as const,
    lists: () => [...queryKeys.formulas.all, 'list'] as const,
    list: (query?: ListFormulasQuery) =>
      [...queryKeys.formulas.lists(), query] as const,
    details: () => [...queryKeys.formulas.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.formulas.details(), id] as const,
  },

  // ─── Templates (io2p-client entity resource) ─────────────
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
    list: (query?: ListTemplatesQuery) =>
      [...queryKeys.templates.lists(), query] as const,
    details: () => [...queryKeys.templates.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.templates.details(), id] as const,
  },

  // ─── Constants (io2p-client leaf resource) ───────────────
  constants: {
    all: ['constants'] as const,
    lists: () => [...queryKeys.constants.all, 'list'] as const,
    list: (query?: ListConstantsQuery) =>
      [...queryKeys.constants.lists(), query] as const,
    details: () => [...queryKeys.constants.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.constants.details(), id] as const,
  },

  // ─── Access (grants + shares; replaces groups) ───────────
  access: {
    all: ['access'] as const,
    grants: {
      // Keyed by type AND id because the request carries both — `WhoCanAccessInput` is
      // `{resourceType, resourceId}`, and a key that drops a request parameter can serve one
      // resource's grants for another.
      forResource: (resourceType: string, resourceId: string) =>
        [...queryKeys.access.all, 'grants', resourceType, resourceId] as const,
      sharedByMe: (query?: { page?: number; size?: number }) =>
        [...queryKeys.access.all, 'sharedByMe', query] as const,
    },
    shares: {
      all: ['access', 'shares'] as const,
      lists: () => [...queryKeys.access.shares.all, 'list'] as const,
      list: (query?: ListSharesQuery) =>
        [...queryKeys.access.shares.lists(), query] as const,
      detail: (id: string) =>
        [...queryKeys.access.shares.all, 'detail', id] as const,
    },
  },
} as const
