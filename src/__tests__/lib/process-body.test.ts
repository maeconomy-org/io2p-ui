import { describe, it, expect } from 'vitest'
import type { ProcessDTO } from 'io2p-client'

import {
  processToDraft,
  buildCreateProcessInput,
  buildUpdateProcessBody,
  findFlowWithoutRef,
  EMPTY_PROCESS_DRAFT,
  QUANTITY_KEY,
  resolveProcessUploadTargets,
} from '@/lib/process-body'
import type { EntityDraft } from '@/lib/entity-body'

function flow(over: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    ref: 'obj-in',
    refName: 'Scrap steel',
    properties: [
      {
        id: 'fp1',
        key: QUANTITY_KEY,
        values: [{ id: 'fv1', data: '1000 kg', source: 'authored' }],
      },
    ],
    ...over,
  }
}

function loaded(over: Partial<ProcessDTO> = {}): ProcessDTO {
  return {
    id: 'proc-1',
    name: 'Recycle batch 12',
    currentVersion: 2,
    properties: [],
    inputs: [flow()],
    outputs: [flow({ id: 'f2', ref: 'obj-out', refName: 'Billet' })],
    ...over,
  } as unknown as ProcessDTO
}

function draft(over: Partial<EntityDraft> = {}): EntityDraft {
  return { ...EMPTY_PROCESS_DRAFT, name: 'Recycle batch 12', ...over }
}

describe('processToDraft', () => {
  it('maps both flow bags, keeping ids and the resolved names', () => {
    const d = processToDraft(loaded())
    expect(d.inputs).toHaveLength(1)
    expect(d.outputs).toHaveLength(1)
    expect(d.inputs![0]).toMatchObject({
      id: 'f1',
      ref: 'obj-in',
      refName: 'Scrap steel',
    })
  })

  it("carries a flow's own properties, so quantity survives the round-trip", () => {
    const d = processToDraft(loaded())
    expect(d.inputs![0].properties[0]).toMatchObject({
      id: 'fp1',
      key: QUANTITY_KEY,
    })
    expect(d.inputs![0].properties[0].values[0].data).toBe('1000 kg')
  })

  // A process has neither, and leaving them unset is what keeps one draft shape usable everywhere.
  it('leaves the object-only facets unset', () => {
    const d = processToDraft(loaded())
    expect(d.address).toBeNull()
    expect(d.parentIds).toEqual([])
  })
})

describe('buildCreateProcessInput', () => {
  it('sends both bags even when empty, so the node reports the real validation error', () => {
    const body = buildCreateProcessInput(draft())
    expect(body.inputs).toEqual([])
    expect(body.outputs).toEqual([])
  })

  it('reduces a flow with no data to just its ref', () => {
    const body = buildCreateProcessInput(
      draft({ inputs: [{ ref: 'obj-in', properties: [] }] })
    )
    expect(body.inputs).toEqual([{ ref: 'obj-in' }])
  })

  it('carries a flow quantity as an ordinary property', () => {
    const body = buildCreateProcessInput(
      draft({
        inputs: [
          {
            ref: 'obj-in',
            properties: [{ key: QUANTITY_KEY, values: [{ data: '1000 kg' }] }],
          },
        ],
      })
    )
    expect(body.inputs![0].properties).toEqual([
      { key: QUANTITY_KEY, values: [{ data: '1000 kg', ref: undefined }] },
    ])
  })

  // A half-filled row (the user clicked Add and stopped) must not become a ref-less flow the node
  // rejects — it just isn't a flow yet.
  it('drops a row whose target was never picked', () => {
    const body = buildCreateProcessInput(
      draft({
        inputs: [
          { ref: '', properties: [] },
          { ref: 'ok', properties: [] },
        ],
      })
    )
    expect(body.inputs).toEqual([{ ref: 'ok' }])
  })
})

describe('buildUpdateProcessBody', () => {
  it('an unchanged draft is a no-op', () => {
    const before = loaded()
    expect(buildUpdateProcessBody(before, processToDraft(before))).toEqual({})
  })

  it('adds a new flow', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.outputs!.push({ ref: 'obj-waste', properties: [] })

    expect(buildUpdateProcessBody(before, d).outputs).toEqual({
      add: [{ ref: 'obj-waste' }],
    })
  })

  // Removal is an unlink — irreversible server-side, so "missing from the draft" is the only signal
  // there is. There is no `restore` section to emit.
  it('removes a flow dropped from the draft, and never emits restore', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs = []

    const body = buildUpdateProcessBody(before, d)
    expect(body.inputs).toEqual({ remove: ['f1'] })
    expect(body.inputs).not.toHaveProperty('restore')
  })

  it('retargets in place by sending only the changed ref', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].ref = 'obj-other'

    expect(buildUpdateProcessBody(before, d).inputs).toEqual({
      update: [{ flowId: 'f1', ref: 'obj-other' }],
    })
  })

  // Re-emitting an unchanged ref would be a pointless write, and `refName` is display-only.
  it('does not send the ref when only the flow data changed', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].properties[0].values[0].data = '900 kg'

    const update = buildUpdateProcessBody(before, d).inputs?.update
    expect(update?.[0]).not.toHaveProperty('ref')
    expect(update?.[0].properties?.update?.[0].values?.update).toEqual([
      { id: 'fv1', data: '900 kg' },
    ])
  })

  it('adds a property to an existing flow', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].properties.push({
      key: 'grade',
      values: [{ data: 'A' }],
    })

    const update = buildUpdateProcessBody(before, d).inputs?.update
    expect(update?.[0].properties?.add).toEqual([
      { key: 'grade', values: [{ data: 'A', ref: undefined }] },
    ])
  })

  it('diffs the two bags independently', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].ref = 'obj-other'

    const body = buildUpdateProcessBody(before, d)
    expect(body.inputs).toBeDefined()
    expect(body.outputs).toBeUndefined()
  })

  it("still diffs the process's own properties like an object", () => {
    const before = loaded({
      properties: [
        {
          id: 'p1',
          key: 'processType',
          values: [{ id: 'v1', data: 'recycle', source: 'authored' }],
        },
      ],
    } as unknown as Partial<ProcessDTO>)
    const d = processToDraft(before)
    d.properties[0].values[0].data = 'downcycle'

    expect(
      buildUpdateProcessBody(before, d).properties?.update?.[0].values?.update
    ).toEqual([{ id: 'v1', data: 'downcycle' }])
  })

  it('renames without touching the flows', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.name = 'Recycle batch 13'

    expect(buildUpdateProcessBody(before, d)).toEqual({
      name: 'Recycle batch 13',
    })
  })
})

describe('findFlowWithoutRef', () => {
  it('returns null when every flow has a target', () => {
    expect(findFlowWithoutRef(processToDraft(loaded()))).toBeNull()
  })

  it('points at the offending bag and row', () => {
    expect(
      findFlowWithoutRef(
        draft({
          inputs: [{ ref: 'ok', properties: [] }],
          outputs: [{ ref: '  ', properties: [] }],
        })
      )
    ).toEqual({ bag: 'outputs', index: 0 })
  })
})

// ── flow-scoped upload targets ──────────────────────────────────────────────
//
// io2p narrows a file's attach target with `flow: {direction, flowId}`. Getting that wrong does not
// error — the file simply lands on the PROCESS instead of the flow, which nothing on screen would
// reveal until someone went looking for it.
describe('resolveProcessUploadTargets', () => {
  const pick = (localId: string) => ({
    _localId: localId,
    kind: 'upload' as const,
    fileName: `${localId}.pdf`,
    blob: new File(['x'], `${localId}.pdf`),
  })

  it('scopes a flow-level file to its flow and direction', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].files = [pick('a')]

    expect(resolveProcessUploadTargets(before, d)).toEqual([
      {
        file: expect.objectContaining({ _localId: 'a' }),
        target: {
          entityId: 'proc-1',
          flow: { direction: 'input', flowId: 'f1' },
        },
      },
    ])
  })

  it('scopes a file on a flow PROPERTY and on a flow VALUE', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs![0].properties[0].files = [pick('p')]
    d.inputs![0].properties[0].values[0].files = [pick('v')]

    const targets = resolveProcessUploadTargets(before, d).map((u) => u.target)
    expect(targets).toEqual([
      {
        entityId: 'proc-1',
        flow: { direction: 'input', flowId: 'f1' },
        propertyId: 'fp1',
      },
      {
        entityId: 'proc-1',
        flow: { direction: 'input', flowId: 'f1' },
        propertyId: 'fp1',
        valueId: 'fv1',
      },
    ])
  })

  it('marks an output flow as an output', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.outputs![0].files = [pick('o')]

    expect(resolveProcessUploadTargets(before, d)[0].target).toEqual({
      entityId: 'proc-1',
      flow: { direction: 'output', flowId: 'f2' },
    })
  })

  it("still resolves the process's own entity and property files", () => {
    const before = loaded()
    const d = processToDraft(before)
    d.files = [pick('e')]

    expect(resolveProcessUploadTargets(before, d)[0].target).toEqual({
      entityId: 'proc-1',
    })
  })

  // A flow added in this session has no id until the save comes back, so it borrows one by ref.
  it('resolves a brand-new flow by its ref', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs!.push({ ref: 'obj-new', properties: [], files: [pick('n')] })

    const committed = {
      ...before,
      inputs: [...before.inputs, { id: 'f9', ref: 'obj-new' }],
    } as unknown as ProcessDTO

    expect(resolveProcessUploadTargets(committed, d)[0].target).toEqual({
      entityId: 'proc-1',
      flow: { direction: 'input', flowId: 'f9' },
    })
  })

  // Two flows may point at the SAME object (io2p allows it — rework, recirculation). Matching purely
  // by ref would send both flows' files to whichever matched first.
  it('claims each committed flow at most once when refs repeat', () => {
    const before = loaded({ inputs: [] } as unknown as Partial<ProcessDTO>)
    const d = processToDraft(before)
    d.inputs = [
      { ref: 'obj-same', properties: [], files: [pick('one')] },
      { ref: 'obj-same', properties: [], files: [pick('two')] },
    ]

    const committed = {
      ...before,
      inputs: [
        { id: 'fa', ref: 'obj-same' },
        { id: 'fb', ref: 'obj-same' },
      ],
    } as unknown as ProcessDTO

    const flowIds = resolveProcessUploadTargets(committed, d).map(
      (u) => u.target.flow?.flowId
    )
    expect(flowIds).toEqual(['fa', 'fb'])
  })

  it('skips a flow it cannot resolve rather than mis-targeting the file', () => {
    const before = loaded()
    const d = processToDraft(before)
    d.inputs!.push({ ref: 'obj-unknown', properties: [], files: [pick('x')] })

    // `committed` never got that flow, so there is no id to attach against.
    expect(resolveProcessUploadTargets(before, d)).toEqual([])
  })
})
