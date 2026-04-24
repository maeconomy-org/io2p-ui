import { describe, it, expect } from 'vitest'

import {
  buildHistoryEvents,
  type HistoryAggregateInput,
} from '@/components/object-sheets/utils/build-history-events'

const user = { userUUID: 'u-1' }

/**
 * Fixture lifted from a real payload: create → rename/abbreviation/version/
 * description edits → add address → upload file → add property → remove
 * property (with a value soft-deleted in the cascade).
 *
 * Timestamps are made-up but deterministic and ordered.
 */
const fixture: HistoryAggregateInput = {
  uuid: 'obj-1',
  name: 'Current Name',
  abbreviation: 'TEST',
  description: 'Final description',
  version: '1.2',
  createdAt: '2026-04-23T14:44:39.000Z',
  lastUpdatedAt: '2026-04-23T14:44:39.000Z',
  createdBy: user,
  lastUpdatedBy: user,
  history: [
    {
      name: 'Original',
      abbreviation: '',
      description: '',
      version: '',
      createdAt: '2026-04-23T13:36:36.000Z',
      createdBy: user,
      lastUpdatedBy: user,
    },
    {
      name: 'Original',
      abbreviation: 'TEST',
      description: '',
      version: '',
      createdAt: '2026-04-23T14:44:00.000Z',
      createdBy: user,
      lastUpdatedBy: user,
    },
    {
      name: 'Original',
      abbreviation: 'TEST',
      description: '',
      version: '1.0',
      createdAt: '2026-04-23T14:44:04.000Z',
      createdBy: user,
      lastUpdatedBy: user,
    },
    {
      name: 'Current Name',
      abbreviation: 'TEST',
      description: '',
      version: '1.1',
      createdAt: '2026-04-23T14:44:08.000Z',
      createdBy: user,
      lastUpdatedBy: user,
    },
    {
      name: 'Current Name',
      abbreviation: 'TEST',
      description: 'Final description',
      version: '1.1',
      createdAt: '2026-04-23T14:44:36.000Z',
      createdBy: user,
      lastUpdatedBy: user,
    },
  ],
  address: {
    fullAddress: 'Tor 11, 81829 Munich, Germany',
    createdAt: '2026-04-23T14:44:51.000Z',
    lastUpdatedAt: '2026-04-23T14:44:51.000Z',
    createdBy: user,
    lastUpdatedBy: user,
  },
  files: [
    {
      uuid: 'file-1',
      fileName: 'screenshot.png',
      size: 75194,
      createdAt: '2026-04-23T14:45:04.000Z',
      createdBy: user,
      softDeleted: false,
    },
  ],
  properties: [
    {
      uuid: 'p-alive',
      key: 'nl-sfb-classification',
      label: 'NL-SfB Classificatie',
      createdAt: '2026-04-23T13:36:36.000Z',
      createdBy: user,
      softDeleted: false,
      values: [
        {
          uuid: 'v-alive',
          value: 'asdasdasd',
          createdAt: '2026-04-23T13:36:36.000Z',
          createdBy: user,
          softDeleted: false,
        },
      ],
    },
    {
      uuid: 'p-dead',
      key: 'barcode',
      label: 'Barcode',
      createdAt: '2026-04-23T13:36:36.000Z',
      createdBy: user,
      softDeleted: true,
      softDeletedAt: '2026-04-23T14:45:19.000Z',
      softDeleteBy: user,
      values: [
        {
          uuid: 'v-dead',
          value: '123123123',
          createdAt: '2026-04-23T13:36:36.000Z',
          createdBy: user,
          softDeleted: true,
          softDeletedAt: '2026-04-23T14:45:19.000Z',
          softDeleteBy: user,
        },
      ],
    },
  ],
}

describe('buildHistoryEvents', () => {
  it('returns empty array for null/undefined aggregate', () => {
    expect(buildHistoryEvents(null)).toEqual([])
    expect(buildHistoryEvents(undefined)).toEqual([])
  })

  it('emits a single "created" event for the earliest metadata snapshot', () => {
    const events = buildHistoryEvents(fixture)
    const created = events.filter(
      (e) => e.category === 'metadata' && e.action === 'created'
    )
    expect(created).toHaveLength(1)
    expect(created[0].timestamp).toBe('2026-04-23T13:36:36.000Z')
    expect(created[0].params.name).toBe('Original')
  })

  it('emits one "updated" event per changed field between consecutive snapshots, skipping noops', () => {
    const events = buildHistoryEvents(fixture).filter(
      (e) => e.category === 'metadata' && e.action === 'updated'
    )
    // Changes across the 5 history entries + current root:
    //   history[0]→history[1]: abbreviation "" → "TEST"         (added)
    //   history[1]→history[2]: version "" → "1.0"               (added)
    //   history[2]→history[3]: name + version both change       (2 events)
    //   history[3]→history[4]: description "" → "Final..."      (added)
    //   history[4]→root:       version "1.1" → "1.2"            (changed)
    expect(events).toHaveLength(6)
    const keys = events.map((e) => e.translationKey)
    expect(keys).toContain('objects.history.events.metadataAdded.abbreviation')
    expect(keys).toContain('objects.history.events.metadataAdded.version')
    expect(keys).toContain('objects.history.events.metadataChanged.name')
    expect(keys).toContain('objects.history.events.metadataAdded.description')
    expect(keys).toContain('objects.history.events.metadataChanged.version')
  })

  it('emits property added and removed events with labels', () => {
    const events = buildHistoryEvents(fixture).filter(
      (e) => e.category === 'property'
    )
    const added = events.filter((e) => e.action === 'created')
    const removed = events.filter((e) => e.action === 'deleted')
    expect(added).toHaveLength(2)
    expect(removed).toHaveLength(1)
    expect(removed[0].params.key).toBe('barcode')
    expect(removed[0].params.label).toBe('Barcode')
  })

  it('emits value added and removed events tagged with the parent property', () => {
    const events = buildHistoryEvents(fixture).filter(
      (e) => e.category === 'value'
    )
    const removed = events.filter((e) => e.action === 'deleted')
    expect(removed).toHaveLength(1)
    expect(removed[0].params.propertyKey).toBe('barcode')
    expect(removed[0].params.value).toBe('123123123')
  })

  it('emits file upload events', () => {
    const events = buildHistoryEvents(fixture).filter(
      (e) => e.category === 'file'
    )
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('created')
    expect(events[0].params.name).toBe('screenshot.png')
    expect(events[0].params.size).toBe(75194)
  })

  it('emits only an address-added event when createdAt == lastUpdatedAt', () => {
    const events = buildHistoryEvents(fixture).filter(
      (e) => e.category === 'address'
    )
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('created')
  })

  it('emits address-updated when lastUpdatedAt differs from createdAt', () => {
    const withEdit: HistoryAggregateInput = {
      ...fixture,
      address: {
        ...(fixture.address ?? {}),
        createdAt: '2026-04-23T14:44:51.000Z',
        lastUpdatedAt: '2026-04-23T15:00:00.000Z',
        createdBy: user,
        lastUpdatedBy: user,
      },
    }
    const events = buildHistoryEvents(withEdit).filter(
      (e) => e.category === 'address'
    )
    expect(events.map((e) => e.action).sort()).toEqual(['created', 'updated'])
  })

  it('sorts all events newest first', () => {
    const events = buildHistoryEvents(fixture)
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].timestamp >= events[i].timestamp).toBe(true)
    }
  })

  it('resolves actor uuid from softDeleteBy for removal events', () => {
    const events = buildHistoryEvents(fixture)
    const propertyRemoval = events.find(
      (e) => e.category === 'property' && e.action === 'deleted'
    )
    expect(propertyRemoval?.actorUuid).toBe('u-1')
  })
})
