import { describe, it, expect } from 'vitest'

import {
  buildCreateObjectInput,
  buildUpdateObjectBody,
  dtoToDraft,
  type EntityDraft,
} from '@/lib/entity-body'
import type { ObjectDTO } from 'io2p-client'

// ── helpers ─────────────────────────────────────────────────────────────────

function draft(over: Partial<EntityDraft> = {}): EntityDraft {
  return { name: 'Wall A', parentIds: [], properties: [], ...over }
}

function loaded(over: Partial<ObjectDTO> = {}): ObjectDTO {
  return {
    id: 'obj-1',
    name: 'Wall A',
    currentVersion: 1,
    properties: [],
    ...over,
  } as ObjectDTO
}

// ── buildCreateObjectInput ──────────────────────────────────────────────────

describe('buildCreateObjectInput', () => {
  it('minimal draft → just the name', () => {
    expect(buildCreateObjectInput(draft())).toEqual({ name: 'Wall A' })
  })

  it('includes description, address, and parents when present', () => {
    const body = buildCreateObjectInput(
      draft({
        description: 'a wall',
        address: { city: 'Zurich' },
        parentIds: ['p1', 'p2'],
      })
    )
    expect(body).toEqual({
      name: 'Wall A',
      description: 'a wall',
      address: { city: 'Zurich' },
      parents: ['p1', 'p2'],
    })
  })

  it('brands each value as authored (data) XOR derived (calc)', () => {
    const body = buildCreateObjectInput(
      draft({
        properties: [
          {
            key: 'weight',
            label: 'Weight',
            values: [
              { data: '100 kg' },
              { calc: { expression: 'a + b', args: [] }, ref: 'v2' },
            ],
          },
        ],
      })
    )
    expect(body.properties).toEqual([
      {
        key: 'weight',
        label: 'Weight',
        values: [
          { data: '100 kg', ref: undefined },
          { calc: { expression: 'a + b', args: [] }, ref: 'v2' },
        ],
      },
    ])
  })

  it('drops empty authored values and empty-key properties', () => {
    const body = buildCreateObjectInput(
      draft({
        properties: [
          { key: 'weight', values: [{ data: '  ' }, { data: '5' }] },
          { key: '', values: [{ data: 'x' }] },
        ],
      })
    )
    expect(body.properties).toEqual([
      { key: 'weight', values: [{ data: '5', ref: undefined }] },
    ])
  })
})

// ── buildUpdateObjectBody ───────────────────────────────────────────────────

describe('buildUpdateObjectBody', () => {
  it('identical draft → empty body (no-op)', () => {
    const before = loaded({ description: 'd', name: 'Wall A' })
    const d = draft({ name: 'Wall A', description: 'd' })
    expect(buildUpdateObjectBody(before, d)).toEqual({})
  })

  it('name change only', () => {
    expect(buildUpdateObjectBody(loaded(), draft({ name: 'Wall B' }))).toEqual({
      name: 'Wall B',
    })
  })

  it('description: set, and clear via empty string → null', () => {
    expect(
      buildUpdateObjectBody(loaded(), draft({ description: 'new' })).description
    ).toBe('new')
    expect(
      buildUpdateObjectBody(
        loaded({ description: 'old' }),
        draft({ description: '' })
      ).description
    ).toBeNull()
  })

  it('address: change and clear', () => {
    expect(
      buildUpdateObjectBody(loaded(), draft({ address: { city: 'Bern' } }))
        .address
    ).toEqual({ city: 'Bern' })
    expect(
      buildUpdateObjectBody(
        loaded({ address: { city: 'Bern' } }),
        draft({ address: null })
      ).address
    ).toBeNull()
    // unchanged address → omitted
    expect(
      buildUpdateObjectBody(
        loaded({ address: { city: 'Bern' } }),
        draft({ address: { city: 'Bern' } })
      )
    ).toEqual({})
  })

  it('parents: diffs into add / remove sets', () => {
    const before = loaded({ parents: [{ id: 'a' }, { id: 'b' }] })
    const body = buildUpdateObjectBody(before, draft({ parentIds: ['b', 'c'] }))
    expect(body.parents).toEqual({ add: ['c'], remove: ['a'] })
  })

  it('property add (no id) / remove (dropped id)', () => {
    const before = loaded({
      properties: [{ id: 'p1', key: 'weight', values: [] }],
    })
    const body = buildUpdateObjectBody(
      before,
      draft({ properties: [{ key: 'height', values: [{ data: '3m' }] }] })
    )
    expect(body.properties?.add).toEqual([
      { key: 'height', values: [{ data: '3m', ref: undefined }] },
    ])
    expect(body.properties?.remove).toEqual(['p1'])
    expect(body.properties?.update).toBeUndefined()
  })

  it('property update: label change only', () => {
    const before = loaded({
      properties: [{ id: 'p1', key: 'weight', label: 'W', values: [] }],
    })
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [{ id: 'p1', key: 'weight', label: 'Weight', values: [] }],
      })
    )
    expect(body.properties?.update).toEqual([{ id: 'p1', label: 'Weight' }])
  })

  it('value add / remove / data-update within a property', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'weight',
          values: [
            { id: 'v1', data: '100', source: 'authored' },
            { id: 'v2', data: '200', source: 'authored' },
          ],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          {
            id: 'p1',
            key: 'weight',
            values: [
              { id: 'v1', data: '150' }, // update
              { data: '300' }, // add (no id)
              // v2 dropped → remove
            ],
          },
        ],
      })
    )
    const values = body.properties?.update?.[0].values
    expect(values?.update).toEqual([{ id: 'v1', data: '150' }])
    expect(values?.add).toEqual([{ data: '300', ref: undefined }])
    expect(values?.remove).toEqual(['v2'])
  })

  it('binds a calc on an existing authored value (rebind)', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'w',
          values: [{ id: 'v1', data: '1', source: 'authored' }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          {
            id: 'p1',
            key: 'w',
            values: [{ id: 'v1', calc: { expression: 'a+b', args: [] } }],
          },
        ],
      })
    )
    expect(body.properties?.update?.[0].values?.update).toEqual([
      { id: 'v1', calc: { expression: 'a+b', args: [] } },
    ])
  })

  it('reverts a derived value to authored (calc:null) — a change only if it WAS derived', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'w',
          values: [{ id: 'v1', data: '3', source: 'derived' }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          { id: 'p1', key: 'w', values: [{ id: 'v1', data: '3', calc: null }] },
        ],
      })
    )
    expect(body.properties?.update?.[0].values?.update).toEqual([
      { id: 'v1', calc: null },
    ])
  })

  it('calc:null on an already-authored value is NOT a change', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'w',
          values: [{ id: 'v1', data: '3', source: 'authored' }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          { id: 'p1', key: 'w', values: [{ id: 'v1', data: '3', calc: null }] },
        ],
      })
    )
    expect(body).toEqual({})
  })

  it('unchanged property is not included in update', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'w',
          label: 'W',
          values: [{ id: 'v1', data: '1', source: 'authored' }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          { id: 'p1', key: 'w', label: 'W', values: [{ id: 'v1', data: '1' }] },
        ],
      })
    )
    expect(body).toEqual({})
  })
})

// ── files (author at value / property / object; lazy-upload id resolved via fileIdMap) ──────────

describe('files', () => {
  const ref = (url: string, label?: string) => ({
    _localId: 'l-' + url,
    kind: 'reference' as const,
    reference: { url },
    ...(label ? { label } : {}),
  })
  const pendingUpload = (localId: string, fileName: string) => ({
    _localId: localId,
    kind: 'upload' as const,
    fileName,
    blob: new File(['x'], fileName),
  })

  it('create: a reference on a value is authored inline (no id, no upload)', () => {
    const body = buildCreateObjectInput(
      draft({
        properties: [
          {
            key: 'spec',
            values: [{ data: 'sheet', files: [ref('https://x/y.pdf', 'Y')] }],
          },
        ],
      })
    )
    expect(body.properties?.[0].values?.[0].files).toEqual([
      { kind: 'reference', reference: { url: 'https://x/y.pdf' }, label: 'Y' },
    ])
  })

  it('create: a pending upload resolves its minted id from the fileIdMap', () => {
    const body = buildCreateObjectInput(
      draft({
        properties: [
          {
            key: 'spec',
            values: [{ data: 'v', files: [pendingUpload('l1', 'a.pdf')] }],
          },
        ],
      }),
      new Map([['l1', 'file-1']])
    )
    expect(body.properties?.[0].values?.[0].files).toEqual([
      { kind: 'upload', id: 'file-1' },
    ])
  })

  it('create: a pending upload with no resolved id is dropped', () => {
    const body = buildCreateObjectInput(
      draft({
        properties: [
          {
            key: 'spec',
            values: [{ data: 'v', files: [pendingUpload('l1', 'a.pdf')] }],
          },
        ],
      })
    )
    expect(body.properties?.[0].values?.[0].files).toBeUndefined()
  })

  it('create: authors object-level and property-level files', () => {
    const body = buildCreateObjectInput(
      draft({
        files: [ref('https://x/obj.pdf')],
        properties: [
          {
            key: 'spec',
            values: [{ data: 'v' }],
            files: [ref('https://x/prop.pdf')],
          },
        ],
      })
    )
    expect(body.files).toEqual([
      { kind: 'reference', reference: { url: 'https://x/obj.pdf' } },
    ])
    expect(body.properties?.[0].files).toEqual([
      { kind: 'reference', reference: { url: 'https://x/prop.pdf' } },
    ])
  })

  it('update: adds a new file and removes a dropped one on an existing value', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'spec',
          values: [
            {
              id: 'v1',
              data: 'v',
              source: 'authored',
              files: [{ id: 'f-old', kind: 'upload' }],
            },
          ],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          {
            id: 'p1',
            key: 'spec',
            values: [
              { id: 'v1', data: 'v', files: [ref('https://x/new.pdf')] },
            ],
          },
        ],
      })
    )
    expect(body.properties?.update?.[0].values?.update).toEqual([
      {
        id: 'v1',
        files: {
          add: [{ kind: 'reference', reference: { url: 'https://x/new.pdf' } }],
          remove: ['f-old'],
        },
      },
    ])
  })

  it('update: a files-only change still emits a value update entry (data omitted)', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'spec',
          values: [{ id: 'v1', data: 'v', source: 'authored', files: [] }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({
        properties: [
          {
            id: 'p1',
            key: 'spec',
            values: [
              { id: 'v1', data: 'v', files: [pendingUpload('l9', 'a.pdf')] },
            ],
          },
        ],
      }),
      new Map([['l9', 'file-9']])
    )
    expect(body.properties?.update?.[0].values?.update).toEqual([
      { id: 'v1', files: { add: [{ kind: 'upload', id: 'file-9' }] } },
    ])
  })

  it('update: diffs entity-level files', () => {
    const before = loaded({
      files: [{ id: 'f-old', kind: 'upload' }],
    } as unknown as Partial<ObjectDTO>)
    const body = buildUpdateObjectBody(
      before,
      draft({ files: [ref('https://x/obj.pdf')] })
    )
    expect(body.files).toEqual({
      add: [{ kind: 'reference', reference: { url: 'https://x/obj.pdf' } }],
      remove: ['f-old'],
    })
  })

  it('update: unchanged files → no body', () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'spec',
          values: [
            {
              id: 'v1',
              data: 'v',
              source: 'authored',
              files: [
                {
                  id: 'f1',
                  kind: 'reference',
                  reference: { url: 'https://x/y' },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as Partial<ObjectDTO>)
    // load → no edits → the file's id is preserved on the draft, so it is neither added nor removed
    expect(buildUpdateObjectBody(before, dtoToDraft(before))).toEqual({})
  })
})

// ── dtoToDraft ──────────────────────────────────────────────────────────────

describe('dtoToDraft', () => {
  it('maps scalars, parents (to ids), and properties/values (with ids)', () => {
    const dto = loaded({
      name: 'Wall A',
      description: 'a wall',
      address: { city: 'Zurich' },
      parents: [{ id: 'p1', name: 'Building' }, { id: 'p2' }],
      properties: [
        {
          id: 'prop1',
          key: 'height',
          label: 'Height',
          values: [{ id: 'v1', data: '3m', source: 'authored' }],
        },
      ],
    } as unknown as Partial<ObjectDTO>)

    expect(dtoToDraft(dto)).toEqual({
      name: 'Wall A',
      description: 'a wall',
      address: { city: 'Zurich' },
      parentIds: ['p1', 'p2'],
      properties: [
        {
          id: 'prop1',
          key: 'height',
          label: 'Height',
          description: undefined,
          values: [{ id: 'v1', data: '3m' }],
        },
      ],
    })
  })

  it('defaults missing description/address/parents/properties to empty', () => {
    const d = dtoToDraft(loaded({ name: 'Bare' }))
    expect(d).toEqual({
      name: 'Bare',
      description: null,
      address: null,
      parentIds: [],
      properties: [],
    })
  })

  it('round-trips: load → no edits → empty PATCH body', () => {
    const dto = loaded({
      name: 'Wall A',
      description: 'a wall',
      address: { city: 'Zurich' },
      parents: [{ id: 'p1', name: 'Building' }],
      properties: [
        {
          id: 'prop1',
          key: 'height',
          label: 'Height',
          values: [
            { id: 'v1', data: '3m', source: 'authored' },
            { id: 'v2', data: '9', source: 'derived' },
          ],
        },
      ],
    } as unknown as Partial<ObjectDTO>)

    expect(buildUpdateObjectBody(dto, dtoToDraft(dto))).toEqual({})
  })
})
