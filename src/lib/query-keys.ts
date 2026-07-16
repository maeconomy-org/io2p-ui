/**
 * Centralized React Query key factory
 *
 * All query keys should be created through this factory to ensure
 * consistency, prevent collisions, and enable targeted invalidation.
 *
 * Pattern: each entity has a base key, with sub-keys for different
 * query variants. Mutations should invalidate the narrowest possible
 * scope using these keys.
 *
 * TARGET CONVENTION (io2p-client model, see internal-docs §12): entity keys are
 * `entity.list(query)` / `entity.detail(id)` / `entity.children(parentId, query)` typed with
 * io2p-client query shapes; invalidation is narrow (`objects.detail(id)` / `objects.lists()`).
 * The `aggregates.*` / `statements.*` / `groups.*` namespaces are DEPRECATED — they retire as their
 * dormant hooks migrate off `iom-sdk`. New resource namespaces (templates/constants/access) below.
 */

import type {
  AggregateFindDTO,
  GroupListParams,
  QueryParams,
  UUStatementsAccessFindDTO,
  UUID,
} from 'iom-sdk'
import type {
  ListTemplatesQuery,
  ListConstantsQuery,
  ListSharesQuery,
  ListFilesQuery,
  ListUsersQuery,
} from '@/types/iom'

export const queryKeys = {
  // ─── Objects ─────────────────────────────────────────────
  objects: {
    all: ['objects'] as const,
    lists: () => [...queryKeys.objects.all, 'list'] as const,
    list: (params?: QueryParams) =>
      [...queryKeys.objects.lists(), params] as const,
    details: () => [...queryKeys.objects.all, 'detail'] as const,
    detail: (uuid: string) => [...queryKeys.objects.details(), uuid] as const,
    byUUIDs: (uuids: string[], includeDeleted?: boolean) =>
      [
        ...queryKeys.objects.all,
        'byUUIDs',
        [...uuids].sort(),
        includeDeleted ?? true,
      ] as const,
  },

  // ─── Aggregates ──────────────────────────────────────────
  // @deprecated io2p-client returns the full aggregate from `objects.get` — retires with use-aggregate.
  aggregates: {
    all: ['aggregates'] as const,
    lists: () => [...queryKeys.aggregates.all, 'list'] as const,
    list: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.lists(), params] as const,
    details: () => [...queryKeys.aggregates.all, 'detail'] as const,
    detail: (uuid: string) =>
      [...queryKeys.aggregates.details(), uuid] as const,
    detailWithHistory: (uuid: string) =>
      [...queryKeys.aggregates.details(), uuid, 'withHistory'] as const,
    models: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.all, 'models', params] as const,
    withHistory: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.all, 'withHistory', params] as const,
    ownGroups: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.all, 'ownGroups', params] as const,
    publicGroups: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.all, 'publicGroups', params] as const,
    sharedGroups: (params?: AggregateFindDTO) =>
      [...queryKeys.aggregates.all, 'sharedGroups', params] as const,
    groups: (
      groupParams: Pick<AggregateFindDTO, 'accessFind'>,
      params?: AggregateFindDTO
    ) => [...queryKeys.aggregates.all, 'groups', groupParams, params] as const,
  },

  // ─── Groups ──────────────────────────────────────────────
  // @deprecated no groups in v2 — sharing moves to `access.*` (grants + shares).
  groups: {
    all: ['groups'] as const,
    lists: () => [...queryKeys.groups.all, 'list'] as const,
    list: (params?: GroupListParams) =>
      [...queryKeys.groups.lists(), params] as const,
    own: (params?: GroupListParams) =>
      [...queryKeys.groups.all, 'own', params] as const,
    shared: (params?: GroupListParams) =>
      [...queryKeys.groups.all, 'shared', params] as const,
    details: () => [...queryKeys.groups.all, 'detail'] as const,
    detail: (uuid: UUID) => [...queryKeys.groups.details(), uuid] as const,
    records: (uuid: UUID, params?: GroupListParams) =>
      [...queryKeys.groups.all, uuid, 'records', params] as const,
  },

  // ─── Properties ──────────────────────────────────────────
  properties: {
    all: ['properties'] as const,
    lists: () => [...queryKeys.properties.all, 'list'] as const,
    list: (params?: QueryParams) =>
      [...queryKeys.properties.lists(), params] as const,
    details: () => [...queryKeys.properties.all, 'detail'] as const,
    detail: (uuid: string) =>
      [...queryKeys.properties.details(), uuid] as const,
  },

  // ─── Statements ──────────────────────────────────────────
  // @deprecated no triples in v2 — relationships are `parents[]`/`ancestor` + first-class processes.
  statements: {
    all: ['statements'] as const,
    lists: () => [...queryKeys.statements.all, 'list'] as const,
    list: (body?: UUStatementsAccessFindDTO) =>
      [...queryKeys.statements.lists(), body] as const,
    byPredicate: (predicate: string) =>
      [...queryKeys.statements.all, 'predicate', predicate] as const,
    relationships: (uuid: UUID) =>
      [...queryKeys.statements.all, 'relationships', uuid] as const,
    objectRelationships: (
      uuid: UUID,
      predicate?: string,
      includeDeleted?: boolean
    ) =>
      [
        ...queryKeys.statements.all,
        'object-relationships',
        uuid,
        predicate,
        includeDeleted,
      ] as const,
  },
  processes: {
    all: ['processes'] as const,
    lists: () => [...queryKeys.processes.all, 'list'] as const,
    detail: (processId: string) =>
      [...queryKeys.processes.all, 'detail', processId] as const,
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
    previewUrl: (uuid: string) =>
      [...queryKeys.files.all, 'previewUrl', uuid] as const,
    lists: () => [...queryKeys.files.all, 'list'] as const,
    list: (query?: ListFilesQuery) =>
      [...queryKeys.files.lists(), query] as const,
    details: () => [...queryKeys.files.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.files.details(), id] as const,
  },

  // ─── Formulas ────────────────────────────────────────────
  formulas: {
    all: ['formulas'] as const,
    lists: () => [...queryKeys.formulas.all, 'list'] as const,
    list: (params?: any) => [...queryKeys.formulas.lists(), params] as const,
    details: () => [...queryKeys.formulas.all, 'detail'] as const,
    detail: (uuid: string) => [...queryKeys.formulas.details(), uuid] as const,
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
      forResource: (resourceId: string) =>
        [...queryKeys.access.all, 'grants', resourceId] as const,
      sharedByMe: () => [...queryKeys.access.all, 'sharedByMe'] as const,
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
