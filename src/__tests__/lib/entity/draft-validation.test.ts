import { describe, it, expect } from 'vitest'

import {
  buildUpdateObjectBody,
  dtoToDraft,
  findEmptyPropertyKey,
  type EntityDraft,
} from '@/lib/entity'
import type { ObjectDTO } from 'io2p-client'

function draft(properties: EntityDraft['properties']): EntityDraft {
  return { name: 'Wall A', parentIds: [], properties }
}

// The builders drop a property with no key, so saving one would silently discard the user's work.
describe('findEmptyPropertyKey', () => {
  it('passes a clean draft', () => {
    expect(
      findEmptyPropertyKey(draft([{ key: 'height', values: [{ data: '3' }] }]))
    ).toBe(-1)
  })

  it('ignores an entirely empty row — an untouched "add property" is not an error', () => {
    expect(
      findEmptyPropertyKey(draft([{ key: '', values: [{ data: '' }] }]))
    ).toBe(-1)
  })

  it('flags a nameless property that has a value', () => {
    expect(
      findEmptyPropertyKey(draft([{ key: '  ', values: [{ data: '3' }] }]))
    ).toBe(0)
  })

  it('flags a nameless property that only has files', () => {
    expect(
      findEmptyPropertyKey(
        draft([
          {
            key: '',
            values: [],
            files: [{ _localId: 'f1', kind: 'upload', fileName: 'a.pdf' }],
          },
        ])
      )
    ).toBe(0)
  })

  it('reports the first offender by index', () => {
    expect(
      findEmptyPropertyKey(
        draft([
          { key: 'ok', values: [{ data: '1' }] },
          { key: '', values: [{ data: '2' }] },
        ])
      )
    ).toBe(1)
  })
})

function loaded(files: ObjectDTO['files']): ObjectDTO {
  return {
    id: 'o1',
    name: 'Wall A',
    currentVersion: 1,
    properties: [],
    files,
  } as unknown as ObjectDTO
}

// Body `remove` is a soft delete with a `restore` counterpart, so a removed file is MARKED, not
// dropped — the diff reports the transition either way.
describe('file soft delete / restore diff', () => {
  const ref = {
    _localId: 'r1',
    id: 'r1',
    kind: 'reference' as const,
    reference: { url: 'https://example.com/a' },
  }

  it('removes a file the draft marked deleted', () => {
    const body = buildUpdateObjectBody(
      loaded([{ id: 'r1', kind: 'reference' }]),
      {
        name: 'Wall A',
        parentIds: [],
        properties: [],
        files: [{ ...ref, deleted: true }],
      }
    )
    expect(body.files?.remove).toEqual(['r1'])
    expect(body.files?.restore).toBeUndefined()
  })

  it('restores a file the draft un-marked', () => {
    const body = buildUpdateObjectBody(
      loaded([{ id: 'r1', kind: 'reference', deleted: true }]),
      {
        name: 'Wall A',
        parentIds: [],
        properties: [],
        files: [{ ...ref, deleted: false }],
      }
    )
    expect(body.files?.restore).toEqual(['r1'])
    expect(body.files?.remove).toBeUndefined()
  })

  it('says nothing when a deleted file is left alone', () => {
    const body = buildUpdateObjectBody(
      loaded([{ id: 'r1', kind: 'reference', deleted: true }]),
      {
        name: 'Wall A',
        parentIds: [],
        properties: [],
        files: [{ ...ref, deleted: true }],
      }
    )
    expect(body.files).toBeUndefined()
  })

  it('still removes a row dropped outright — nothing was stored to preserve', () => {
    const body = buildUpdateObjectBody(
      loaded([{ id: 'r1', kind: 'reference' }]),
      {
        name: 'Wall A',
        parentIds: [],
        properties: [],
        files: [],
      }
    )
    expect(body.files?.remove).toEqual(['r1'])
  })
})

// The sheet reads with includeDeleted so deleted FILES can render struck-through. Deleted properties
// and values have no such UI yet, so they must not leak into the draft — and must stay invisible to
// the diff, or every save would re-remove something already deleted.
describe('soft-deleted sub-items from an includeDeleted read', () => {
  const withDeleted = {
    id: 'o1',
    name: 'Wall A',
    currentVersion: 1,
    properties: [
      { id: 'p1', key: 'height', values: [{ id: 'v1', data: '3' }] },
      { id: 'p2', key: 'gone', deleted: true, values: [] },
      {
        id: 'p3',
        key: 'width',
        values: [
          { id: 'v2', data: '2' },
          { id: 'v3', data: 'old', deleted: true },
        ],
      },
    ],
  } as unknown as ObjectDTO

  // Nothing is hidden: a deleted property/value arrives MARKED so it can render struck-through with
  // a Restore action. Dropping it would make restore impossible and the deletion look permanent.
  it('carries deleted properties and values into the draft, marked', () => {
    const draft = dtoToDraft(withDeleted)

    expect(draft.properties.map((p) => p.key)).toEqual([
      'height',
      'gone',
      'width',
    ])
    expect(draft.properties[1].deleted).toBe(true)
    expect(draft.properties[2].values.map((v) => v.deleted)).toEqual([
      undefined,
      true,
    ])
  })

  it('does not re-remove them on an otherwise untouched save', () => {
    const body = buildUpdateObjectBody(withDeleted, dtoToDraft(withDeleted))
    expect(body.properties).toBeUndefined()
  })

  it('removes a property the draft newly marked deleted', () => {
    const draft = dtoToDraft(withDeleted)
    draft.properties[0].deleted = true

    const body = buildUpdateObjectBody(withDeleted, draft)
    expect(body.properties?.remove).toEqual(['p1'])
    expect(body.properties?.restore).toBeUndefined()
  })

  it('restores a property the draft un-marked', () => {
    const draft = dtoToDraft(withDeleted)
    draft.properties[1].deleted = false

    const body = buildUpdateObjectBody(withDeleted, draft)
    expect(body.properties?.restore).toEqual(['p2'])
    expect(body.properties?.remove).toBeUndefined()
  })

  it('removes and restores values through the property update', () => {
    const draft = dtoToDraft(withDeleted)
    draft.properties[2].values[0].deleted = true // v2 live -> deleted
    draft.properties[2].values[1].deleted = false // v3 deleted -> live

    const body = buildUpdateObjectBody(withDeleted, draft)
    const update = body.properties?.update?.find((p) => p.id === 'p3')
    expect(update?.values?.remove).toEqual(['v2'])
    expect(update?.values?.restore).toEqual(['v3'])
  })

  // A deleted row is not an editable row: pushing its data would resurrect content on the server
  // while the UI still shows it struck through.
  it('sends no edits for a value that is deleted in the draft', () => {
    const draft = dtoToDraft(withDeleted)
    draft.properties[2].values[1].data = 'typed while deleted'

    const body = buildUpdateObjectBody(withDeleted, draft)
    expect(body.properties).toBeUndefined()
  })
})
