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
  AggregateFindDTO,
  GroupListParams,
  QueryParams,
  UUStatementsAccessFindDTO,
  UUID,
} from 'iom-sdk'

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

  // ─── Addresses ───────────────────────────────────────────
  addresses: {
    all: ['addresses'] as const,
    detail: (uuid: string) => [...queryKeys.addresses.all, uuid] as const,
  },

  // ─── Users ───────────────────────────────────────────────
  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    findByIdentifier: (identifier: string) =>
      ['users', 'findByIdentifier', identifier] as const,
  },

  // ─── Files (presigned URLs) ──────────────────────────────
  // Short-lived presigned URLs from the file-storage service. Stale time is
  // set on the hooks to refetch before backend TTL expiry.
  files: {
    all: ['files'] as const,
    previewUrl: (uuid: string) =>
      [...queryKeys.files.all, 'previewUrl', uuid] as const,
  },

  // ─── Formulas ────────────────────────────────────────────
  formulas: {
    all: ['formulas'] as const,
    lists: () => [...queryKeys.formulas.all, 'list'] as const,
    list: (params?: any) => [...queryKeys.formulas.lists(), params] as const,
    details: () => [...queryKeys.formulas.all, 'detail'] as const,
    detail: (uuid: string) => [...queryKeys.formulas.details(), uuid] as const,
  },
} as const
