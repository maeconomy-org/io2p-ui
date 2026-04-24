/**
 * Synthesize a unified event timeline from an aggregate object payload
 * (as returned by `searchAggregates` with `hasHistory: true`).
 *
 * The backend exposes history through three mechanisms:
 *   1. `root.history[]`     — full metadata snapshots of the object, each
 *                             marked softDeleted at the moment it was
 *                             superseded. Plus the live root itself.
 *   2. `softDeleted: true`  — on properties, values, and files that were
 *                             removed.
 *   3. `createdAt`          — on every entity, lets us render "added" events
 *                             even though the backend emits no explicit
 *                             creation events.
 *
 * What this module does NOT try to reconstruct:
 *   - Prior values of live property values (backend never snapshots them).
 *   - Address field-level diffs (single embedded row, only timestamps).
 *   - File replacements.
 */

export type HistoryEventCategory =
  | 'metadata'
  | 'property'
  | 'value'
  | 'file'
  | 'address'

export type HistoryEventAction = 'created' | 'updated' | 'deleted'

export interface HistoryEvent {
  /** Stable id for React keys — composed of category + target + timestamp. */
  id: string
  category: HistoryEventCategory
  action: HistoryEventAction
  /** ISO timestamp of the event, used for sorting and display. */
  timestamp: string
  /** User UUID responsible for the event, if known. */
  actorUuid: string | null
  /**
   * Short i18n-ready descriptor for the row sentence. The renderer resolves
   * `translationKey` + interpolates `params`. Kept as a data shape rather
   * than a pre-rendered string so translation happens at render time.
   */
  translationKey: string
  params: Record<string, string | number>
}

interface UserRef {
  userUUID?: string | null
}

interface MetadataSnapshot {
  name?: string
  abbreviation?: string
  description?: string
  version?: string
  createdAt?: string
  lastUpdatedAt?: string
  createdBy?: UserRef | null
  lastUpdatedBy?: UserRef | null
  softDeletedAt?: string | null
}

interface PropertyValueLike {
  uuid?: string
  value?: string
  createdAt?: string
  softDeleted?: boolean
  softDeletedAt?: string | null
  createdBy?: UserRef | null
  softDeleteBy?: UserRef | null
}

interface PropertyLike {
  uuid?: string
  key?: string
  label?: string
  values?: PropertyValueLike[]
  createdAt?: string
  softDeleted?: boolean
  softDeletedAt?: string | null
  createdBy?: UserRef | null
  softDeleteBy?: UserRef | null
}

interface FileLike {
  uuid?: string
  fileName?: string | null
  size?: number
  createdAt?: string
  softDeleted?: boolean
  softDeletedAt?: string | null
  createdBy?: UserRef | null
  softDeleteBy?: UserRef | null
}

interface AddressLike {
  fullAddress?: string
  createdAt?: string
  lastUpdatedAt?: string
  createdBy?: UserRef | null
  lastUpdatedBy?: UserRef | null
}

export interface HistoryAggregateInput {
  uuid?: string
  name?: string
  abbreviation?: string
  description?: string
  version?: string
  createdAt?: string
  lastUpdatedAt?: string
  createdBy?: UserRef | null
  lastUpdatedBy?: UserRef | null
  history?: MetadataSnapshot[]
  properties?: PropertyLike[]
  files?: FileLike[]
  address?: AddressLike | null
}

const METADATA_FIELDS: Array<keyof MetadataSnapshot> = [
  'name',
  'abbreviation',
  'description',
  'version',
]

const userOf = (ref: UserRef | null | undefined): string | null =>
  ref?.userUUID ?? null

const norm = (v: string | undefined): string => v ?? ''

/**
 * Build events from the metadata snapshot chain.
 * Walks [...history, root] sorted by createdAt ascending, emits:
 *   - a single "created" event at the very first snapshot
 *   - one "updated" event per changed field between consecutive snapshots
 */
function buildMetadataEvents(root: HistoryAggregateInput): HistoryEvent[] {
  const snapshots: MetadataSnapshot[] = [
    ...(root.history ?? []),
    {
      name: root.name,
      abbreviation: root.abbreviation,
      description: root.description,
      version: root.version,
      createdAt: root.createdAt,
      lastUpdatedAt: root.lastUpdatedAt,
      createdBy: root.createdBy,
      lastUpdatedBy: root.lastUpdatedBy,
    },
  ]
    .filter((s) => !!s.createdAt)
    .sort((a, b) => (a.createdAt! < b.createdAt! ? -1 : 1))

  if (snapshots.length === 0) return []

  const events: HistoryEvent[] = []

  const first = snapshots[0]
  events.push({
    id: `metadata-created-${first.createdAt}`,
    category: 'metadata',
    action: 'created',
    timestamp: first.createdAt!,
    actorUuid: userOf(first.createdBy),
    translationKey: 'objects.history.events.metadataCreated',
    params: { name: norm(first.name) },
  })

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const next = snapshots[i]
    const actor =
      userOf(next.lastUpdatedBy) ??
      userOf(next.createdBy) ??
      userOf(prev.lastUpdatedBy)

    for (const field of METADATA_FIELDS) {
      const before = norm(prev[field] as string | undefined)
      const after = norm(next[field] as string | undefined)
      if (before === after) continue

      let translationKey = `objects.history.events.metadataChanged.${field}`
      if (!before)
        translationKey = `objects.history.events.metadataAdded.${field}`
      if (!after)
        translationKey = `objects.history.events.metadataCleared.${field}`

      events.push({
        id: `metadata-${field}-${next.createdAt}`,
        category: 'metadata',
        action: 'updated',
        timestamp: next.createdAt!,
        actorUuid: actor,
        translationKey,
        params: { before, after },
      })
    }
  }

  return events
}

function buildPropertyEvents(props: PropertyLike[]): HistoryEvent[] {
  const events: HistoryEvent[] = []
  for (const p of props) {
    const targetLabel = p.label || p.key || p.uuid || ''
    if (p.createdAt) {
      events.push({
        id: `property-created-${p.uuid ?? p.key}-${p.createdAt}`,
        category: 'property',
        action: 'created',
        timestamp: p.createdAt,
        actorUuid: userOf(p.createdBy),
        translationKey: 'objects.history.events.propertyAdded',
        params: { key: p.key ?? '', label: targetLabel },
      })
    }
    if (p.softDeleted && p.softDeletedAt) {
      events.push({
        id: `property-deleted-${p.uuid ?? p.key}-${p.softDeletedAt}`,
        category: 'property',
        action: 'deleted',
        timestamp: p.softDeletedAt,
        actorUuid: userOf(p.softDeleteBy),
        translationKey: 'objects.history.events.propertyRemoved',
        params: { key: p.key ?? '', label: targetLabel },
      })
    }
  }
  return events
}

function buildValueEvents(props: PropertyLike[]): HistoryEvent[] {
  const events: HistoryEvent[] = []
  for (const p of props) {
    const parentLabel = p.label || p.key || ''
    for (const v of p.values ?? []) {
      if (v.createdAt) {
        events.push({
          id: `value-created-${v.uuid}-${v.createdAt}`,
          category: 'value',
          action: 'created',
          timestamp: v.createdAt,
          actorUuid: userOf(v.createdBy),
          translationKey: 'objects.history.events.valueAdded',
          params: {
            value: norm(v.value),
            propertyKey: p.key ?? '',
            propertyLabel: parentLabel,
          },
        })
      }
      if (v.softDeleted && v.softDeletedAt) {
        events.push({
          id: `value-deleted-${v.uuid}-${v.softDeletedAt}`,
          category: 'value',
          action: 'deleted',
          timestamp: v.softDeletedAt,
          actorUuid: userOf(v.softDeleteBy),
          translationKey: 'objects.history.events.valueRemoved',
          params: {
            value: norm(v.value),
            propertyKey: p.key ?? '',
            propertyLabel: parentLabel,
          },
        })
      }
    }
  }
  return events
}

function buildFileEvents(files: FileLike[]): HistoryEvent[] {
  const events: HistoryEvent[] = []
  for (const f of files) {
    const name = f.fileName ?? ''
    if (f.createdAt) {
      events.push({
        id: `file-created-${f.uuid}-${f.createdAt}`,
        category: 'file',
        action: 'created',
        timestamp: f.createdAt,
        actorUuid: userOf(f.createdBy),
        translationKey: 'objects.history.events.fileUploaded',
        params: { name, size: f.size ?? 0 },
      })
    }
    if (f.softDeleted && f.softDeletedAt) {
      events.push({
        id: `file-deleted-${f.uuid}-${f.softDeletedAt}`,
        category: 'file',
        action: 'deleted',
        timestamp: f.softDeletedAt,
        actorUuid: userOf(f.softDeleteBy),
        translationKey: 'objects.history.events.fileRemoved',
        params: { name },
      })
    }
  }
  return events
}

function buildAddressEvents(address: AddressLike | null): HistoryEvent[] {
  if (!address || !address.createdAt) return []
  const events: HistoryEvent[] = [
    {
      id: `address-created-${address.createdAt}`,
      category: 'address',
      action: 'created',
      timestamp: address.createdAt,
      actorUuid: userOf(address.createdBy),
      translationKey: 'objects.history.events.addressAdded',
      params: { fullAddress: address.fullAddress ?? '' },
    },
  ]
  if (address.lastUpdatedAt && address.lastUpdatedAt !== address.createdAt) {
    events.push({
      id: `address-updated-${address.lastUpdatedAt}`,
      category: 'address',
      action: 'updated',
      timestamp: address.lastUpdatedAt,
      actorUuid: userOf(address.lastUpdatedBy),
      translationKey: 'objects.history.events.addressUpdated',
      params: { fullAddress: address.fullAddress ?? '' },
    })
  }
  return events
}

/**
 * Turn an aggregate object payload into a newest-first list of history
 * events. Pure; no i18n, no user lookup — the UI layer resolves those.
 */
export function buildHistoryEvents(
  aggregate: HistoryAggregateInput | null | undefined
): HistoryEvent[] {
  if (!aggregate) return []

  const events: HistoryEvent[] = [
    ...buildMetadataEvents(aggregate),
    ...buildPropertyEvents(aggregate.properties ?? []),
    ...buildValueEvents(aggregate.properties ?? []),
    ...buildFileEvents(aggregate.files ?? []),
    ...buildAddressEvents(aggregate.address ?? null),
  ]

  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  return events
}
