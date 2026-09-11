import { describe, it, expect } from 'vitest'
import type { ObjectDTO, TemplateDTO } from 'io2p-client'

import {
  templateToDraft,
  templatePresetToDraftProperties,
  objectToTemplateInput,
  placeholderValue,
  buildCreateTemplateInput,
  buildUpdateTemplateBody,
} from '@/lib/entity'

const TEMPLATE = {
  id: 'tpl-1',
  type: 'object',
  name: 'Wall',
  description: 'A wall',
  version: '1.0',
  system: false,
  currentVersion: 3,
  createdAt: 1,
  updatedAt: 2,
  createdBy: 'u1',
  deleted: false,
  properties: [
    {
      id: 'p1',
      key: 'height',
      label: 'Height',
      values: [{ id: 'v1', data: '3', source: 'authored' }],
    },
  ],
} as unknown as TemplateDTO

describe('templateToDraft', () => {
  /**
   * A template save replaces the whole tree, so every id the read returned stops existing the moment
   * it is written. Carrying them into the draft would leave the UI holding stale ids and imply a
   * soft-delete the replace model cannot express.
   */
  it('drops server ids', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.properties[0].id).toBeUndefined()
    expect(draft.properties[0].values[0].id).toBeUndefined()
  })

  // `ref` is how a calc binds a sibling within one request. Without carrying the old id across as a
  // ref, every held formula binding would dangle after the replace.
  it('keeps each value reachable by ref, using its former id', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.properties[0].values[0].ref).toBe('v1')
  })

  it('carries the authored version label and leaves the object facets unset', () => {
    const draft = templateToDraft(TEMPLATE)

    expect(draft.version).toBe('1.0')
    expect(draft.parentIds).toEqual([])
    expect(draft.address).toBeNull()
  })
})

describe('buildCreateTemplateInput', () => {
  it('defaults to an object template and carries the authored fields', () => {
    const body = buildCreateTemplateInput(templateToDraft(TEMPLATE))

    expect(body.type).toBe('object')
    expect(body.name).toBe('Wall')
    expect(body.version).toBe('1.0')
    expect(body.properties).toHaveLength(1)
  })

  it('omits a property with no key rather than sending a nameless one', () => {
    const body = buildCreateTemplateInput({
      ...templateToDraft(TEMPLATE),
      properties: [{ key: '  ', values: [{ data: 'orphan' }] }],
    })

    expect(body.properties).toBeUndefined()
  })
})

describe('buildUpdateTemplateBody', () => {
  it('is a no-op when nothing changed', () => {
    const body = buildUpdateTemplateBody(TEMPLATE, templateToDraft(TEMPLATE))

    expect(body).toEqual({})
  })

  it('sends only the scalar that changed', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.name = 'Wall B'

    expect(buildUpdateTemplateBody(TEMPLATE, draft)).toEqual({ name: 'Wall B' })
  })

  // Replacement, not diff: one edited value re-sends the whole collection.
  it('replaces the whole property collection when any part of it changed', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.properties[0].values[0].data = '4'

    const body = buildUpdateTemplateBody(TEMPLATE, draft)
    expect(body.properties).toHaveLength(1)
    expect(body.properties?.[0].values?.[0].data).toBe('4')
    expect(body.name).toBeUndefined()
  })

  it('drops a removed property by omitting it from the replacement', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.properties = []

    expect(buildUpdateTemplateBody(TEMPLATE, draft).properties).toEqual([])
  })

  it('clears a description the user emptied', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.description = ''

    expect(buildUpdateTemplateBody(TEMPLATE, draft).description).toBe('')
  })

  // A removed reference produces an empty `add` list either way, so absence has to be detected
  // against the BEFORE state — otherwise deleting the last file would look like no change at all.
  it('replaces files when one was removed, even though the built list is empty', () => {
    const before = {
      ...TEMPLATE,
      files: [{ id: 'f1', kind: 'reference', reference: { url: 'https://x' } }],
    } as unknown as TemplateDTO
    const draft = templateToDraft(before)
    draft.files = []

    expect(buildUpdateTemplateBody(before, draft).files).toEqual([])
  })
})

// ── files survive without a UI ───────────────────────────────────────────────
//
// The template sheet has no files control (io2p cannot make a template an upload target), but a
// template may still carry reference files from an import or an earlier build. Because templates
// write by REPLACEMENT, the builder must round-trip them: the moment `files` is sent as an empty
// array, whatever the template held is gone. There is no UI path to notice, so these are the guard.
describe('reference files with no editing UI', () => {
  const withFiles = {
    ...TEMPLATE,
    files: [
      { id: 'f1', kind: 'reference', reference: { url: 'https://spec.pdf' } },
    ],
  } as unknown as TemplateDTO

  it('loads existing files into the draft even though nothing renders them', () => {
    expect(templateToDraft(withFiles).files).toHaveLength(1)
    expect(templateToDraft(withFiles).files?.[0]).toMatchObject({ id: 'f1' })
  })

  it('OMITS files from an otherwise-unchanged save, so the server keeps them', () => {
    const body = buildUpdateTemplateBody(withFiles, templateToDraft(withFiles))
    expect(body).not.toHaveProperty('files')
    expect(body).toEqual({})
  })

  it('still omits files when an unrelated field changed', () => {
    const draft = templateToDraft(withFiles)
    draft.name = 'Renamed'
    const body = buildUpdateTemplateBody(withFiles, draft)
    expect(body.name).toBe('Renamed')
    expect(body).not.toHaveProperty('files')
  })

  // The failure this whole block exists to catch: a draft that forgot to load them.
  it('would wipe them if the draft dropped files — proving the load is load-bearing', () => {
    const forgetful = { ...templateToDraft(withFiles), files: [] }
    expect(buildUpdateTemplateBody(withFiles, forgetful).files).toEqual([])
  })
})

// ── inert formula recipes survive a round-trip ───────────────────────────────
//
// A template stores its calc INERT (E-2): `source:'derived'` + `calc` verbatim, no `num`, no
// `provenance` — it computes only when the template is APPLIED to a real entity. So a bound value has
// no `data` to fall back on. If the draft drops `calc`, the value loads blank AND the next save
// replaces the recipe with that blank. Nothing on screen would show it happened.
describe('inert calc recipes', () => {
  const CALC = { formulaId: 'f-area', args: [{ var: 'a', ref: 'tmp-h' }] }

  const withFormula = {
    ...TEMPLATE,
    properties: [
      {
        id: 'p1',
        key: 'height',
        label: 'Height',
        values: [{ id: 'v1', ref: 'tmp-h', data: '3', source: 'authored' }],
      },
      {
        id: 'p2',
        key: 'area',
        label: 'Area',
        values: [
          { id: 'v2', ref: 'tmp-a', data: '', source: 'derived', calc: CALC },
        ],
      },
    ],
  } as unknown as TemplateDTO

  it('carries the recipe into the draft', () => {
    const draft = templateToDraft(withFormula)
    expect(draft.properties[1].values[0].calc).toEqual(CALC)
  })

  // The calc arg points at the value's client `ref`, NOT its server id. Rewriting refs to ids would
  // leave `tmp-h` naming nothing, so the binding would render as unbound and save as unbound.
  it('keeps the client ref the calc arg references, not the server id', () => {
    const draft = templateToDraft(withFormula)
    expect(draft.properties[0].values[0].ref).toBe('tmp-h')
    expect(draft.properties[1].values[0].ref).toBe('tmp-a')

    const argRef = draft.properties[1].values[0].calc?.args[0]?.ref
    const refs = draft.properties.flatMap((p) => p.values.map((v) => v.ref))
    expect(refs).toContain(argRef)
  })

  it('falls back to the server id when a value predates refs', () => {
    const seeded = {
      ...TEMPLATE,
      properties: [
        {
          id: 'p1',
          key: 'h',
          values: [{ id: 'v1', data: '3', source: 'authored' }],
        },
      ],
    } as unknown as TemplateDTO
    expect(templateToDraft(seeded).properties[0].values[0].ref).toBe('v1')
  })

  it('an untouched formula template saves as a no-op', () => {
    expect(
      buildUpdateTemplateBody(withFormula, templateToDraft(withFormula))
    ).toEqual({})
  })

  it('re-sends the recipe intact when an unrelated property changed', () => {
    const draft = templateToDraft(withFormula)
    draft.properties[0].values[0].data = '4'

    const values = buildUpdateTemplateBody(withFormula, draft).properties?.[1]
      ?.values
    expect(values?.[0]).toMatchObject({ calc: CALC, ref: 'tmp-a' })
  })

  // A recipe-bearing value has empty `data`; the builder must keep it on `isRealCalc`, not on text.
  it('does not drop a bound value for having no text', () => {
    const props = buildCreateTemplateInput(
      templateToDraft(withFormula)
    ).properties
    expect(props?.[1]?.values).toHaveLength(1)
    expect(props?.[1]?.values?.[0]).toMatchObject({ calc: CALC })
  })

  // The failure this block exists to catch.
  it('would blank the recipe if the draft dropped calc', () => {
    const draft = templateToDraft(withFormula)
    draft.properties[1].values[0].calc = undefined

    const values = buildUpdateTemplateBody(withFormula, draft).properties?.[1]
      ?.values
    expect(values ?? []).toHaveLength(0)
  })
})

// ── applying a template to a NEW entity ─────────────────────────────────────
//
// Applying is client-side (D70): the create form copies the preset in. It used to copy only the KEYS,
// replacing every value with a single blank one and a fresh ref — which silently discarded preset
// defaults, extra values, and every formula the template held. The formula then showed as a plain
// text box with no mapping.
describe('templatePresetToDraftProperties', () => {
  const CALC = { formulaId: 'f-area', args: [{ var: 'h', ref: 'tmp-h' }] }

  const preset = [
    { key: 'height', label: 'Height', values: [{ data: '3', ref: 'tmp-h' }] },
    {
      key: 'area',
      label: 'Area',
      values: [{ data: '', ref: 'tmp-a', calc: CALC }],
    },
  ]

  it('carries the formula recipe onto the new draft', () => {
    expect(templatePresetToDraftProperties(preset)[1].values[0].calc).toEqual(
      CALC
    )
  })

  // The recipe binds by ref, and the node resolves refs within one request — so the ref a value
  // declares and the ref the arg names must still match after the copy.
  it('keeps value refs and calc arg refs consistent', () => {
    const props = templatePresetToDraftProperties(preset)
    const argRef = props[1].values[0].calc?.args[0]?.ref
    const declared = props.flatMap((p) => p.values.map((v) => v.ref))
    expect(declared).toContain(argRef)
  })

  it('keeps preset data as a default the user can overwrite', () => {
    expect(templatePresetToDraftProperties(preset)[0].values[0].data).toBe('3')
  })

  it('keeps every value, not just the first', () => {
    const multi = [
      { key: 'k', values: [{ data: 'a' }, { data: 'b' }, { data: 'c' }] },
    ]
    expect(templatePresetToDraftProperties(multi)[0].values).toHaveLength(3)
  })

  it('gives a property with no preset values one empty editable value', () => {
    const bare = [{ key: 'k' }]
    expect(templatePresetToDraftProperties(bare)[0].values).toEqual([
      { data: '', ref: expect.any(String) },
    ])
  })

  it('mints a ref for a preset value that has none, so a formula can bind to it', () => {
    const old = [{ key: 'k', values: [{ data: '1' }] }]
    expect(templatePresetToDraftProperties(old)[0].values[0].ref).toEqual(
      expect.any(String)
    )
  })

  it('carries label and description through', () => {
    const described = [{ key: 'k', label: 'K', description: 'about k' }]
    expect(templatePresetToDraftProperties(described)[0]).toMatchObject({
      key: 'k',
      label: 'K',
      description: 'about k',
    })
  })

  it('handles an absent preset', () => {
    expect(templatePresetToDraftProperties(undefined)).toEqual([])
  })

  // A blank value with no calc must NOT be given one — only real recipes travel.
  it('does not invent a calc on a plain value', () => {
    expect(
      templatePresetToDraftProperties(preset)[0].values[0]
    ).not.toHaveProperty('calc')
  })
})

// ── placeholderValue ────────────────────────────────────────────────────────
//
// The old "create template from object" replaced every value with the string 'Variable'. That is not
// a number, so any formula binding to it became unbindable — the template silently lost the mapping
// it was meant to carry. Zeroing the number while keeping the unit keeps both the mapping and the
// dimension hint, and still reads as a placeholder rather than the source object's measurement.
describe('placeholderValue', () => {
  it('zeroes the number and keeps the unit', () => {
    expect(placeholderValue('3.5 m')).toBe('0 m')
    expect(placeholderValue('1000 kg')).toBe('0 kg')
    expect(placeholderValue('12 m2')).toBe('0 m2')
  })

  it('keeps a bare number numeric', () => {
    expect(placeholderValue('42')).toBe('0')
  })

  it('handles no space between number and unit', () => {
    expect(placeholderValue('10m')).toBe('0 m')
  })

  it('blanks values with no leading number — those are instance data', () => {
    expect(placeholderValue('X-4471')).toBe('')
    expect(placeholderValue('Acme Ltd')).toBe('')
    expect(placeholderValue('')).toBe('')
    expect(placeholderValue(undefined)).toBe('')
  })

  // The exact failure the old placeholder caused.
  it('never yields a non-numeric placeholder for a numeric source', () => {
    for (const input of ['3.5 m', '42', '10m', '1000 kg']) {
      expect(Number.isFinite(Number.parseFloat(placeholderValue(input)))).toBe(
        true
      )
    }
  })
})

// ── objectToTemplateInput ───────────────────────────────────────────────────

describe('objectToTemplateInput', () => {
  const PROVENANCE = {
    expression: 'h * w',
    formulaId: 'f-area',
    evalVersion: 1,
    args: [
      { var: 'h', source: { kind: 'property', valueId: 'v-h' } },
      { var: 'w', source: { kind: 'property', valueId: 'v-w' } },
    ],
  }

  const source = {
    id: 'obj-1',
    name: 'Wall A',
    currentVersion: 2,
    properties: [
      {
        id: 'p1',
        key: 'height',
        label: 'Height',
        values: [{ id: 'v-h', data: '3.5 m', source: 'authored' }],
      },
      {
        id: 'p2',
        key: 'width',
        label: 'Width',
        values: [{ id: 'v-w', data: '2 m', source: 'authored' }],
      },
      {
        id: 'p3',
        key: 'area',
        label: 'Area',
        values: [
          {
            id: 'v-a',
            data: '7 m2',
            source: 'derived',
            provenance: PROVENANCE,
          },
        ],
      },
      {
        id: 'p4',
        key: 'barcode',
        values: [{ id: 'v-b', data: 'X-4471', source: 'authored' }],
      },
    ],
  } as unknown as ObjectDTO

  const build = () =>
    objectToTemplateInput(source, { name: 'Wall Template', version: '1.0' })

  it('creates an object template with the given metadata', () => {
    const body = build()
    expect(body.type).toBe('object')
    expect(body.name).toBe('Wall Template')
    expect(body.version).toBe('1.0')
  })

  it('zeroes numeric values and blanks text ones', () => {
    const props = build().properties!
    expect(props[0].values![0]).toMatchObject({ data: '0 m' })
    expect(props[3].values![0]).toMatchObject({ data: '' })
  })

  it('carries a derived value as a RECIPE, not its computed result', () => {
    const area = build().properties![2].values![0]
    expect(area).toMatchObject({
      calc: {
        formulaId: 'f-area',
        args: [
          { var: 'h', ref: 'v-h' },
          { var: 'w', ref: 'v-w' },
        ],
      },
    })
    expect(area).not.toHaveProperty('data')
  })

  // The recipe names its inputs by the SOURCE value ids, so those same ids must be the template
  // values' refs — otherwise the args point at nothing the create body declares.
  it('keeps every calc arg resolvable against a declared ref', () => {
    const props = build().properties!
    const declared = props.flatMap((p) => (p.values ?? []).map((v) => v.ref))
    const args = props
      .flatMap((p) => p.values ?? [])
      .flatMap((v) => v.calc?.args ?? [])
    expect(args).toHaveLength(2)
    for (const arg of args) expect(declared).toContain(arg.ref)
  })

  it('skips a recipe it cannot express rather than freezing a stale number', () => {
    const inline = {
      ...source,
      properties: [
        {
          id: 'p1',
          key: 'area',
          values: [
            {
              id: 'v-a',
              data: '7',
              source: 'derived',
              // No formulaId — an ad-hoc expression, which calc can't round-trip.
              provenance: { ...PROVENANCE, formulaId: undefined },
            },
          ],
        },
      ],
    } as unknown as ObjectDTO
    const props = objectToTemplateInput(inline, { name: 'T' }).properties!
    expect(props[0].values).toBeUndefined()
  })

  it('resolves a constant argument to its name', () => {
    const withConstant = {
      ...source,
      properties: [
        {
          id: 'p1',
          key: 'area',
          values: [
            {
              id: 'v-a',
              data: '7',
              source: 'derived',
              provenance: {
                ...PROVENANCE,
                args: [
                  { var: 'k', source: { kind: 'constant', constantId: 'c1' } },
                ],
              },
            },
          ],
        },
      ],
    } as unknown as ObjectDTO
    const props = objectToTemplateInput(withConstant, { name: 'T' }).properties!
    expect(props[0].values![0].calc?.args[0]).toEqual({
      var: 'k',
      constantId: 'c1',
    })
  })

  it('omits soft-deleted properties and values', () => {
    const withDeleted = {
      ...source,
      properties: [
        {
          id: 'p1',
          key: 'gone',
          deleted: true,
          values: [{ id: 'v1', data: '1', source: 'authored' }],
        },
        {
          id: 'p2',
          key: 'kept',
          values: [
            { id: 'v2', data: '1', source: 'authored', deleted: true },
            { id: 'v3', data: '2', source: 'authored' },
          ],
        },
      ],
    } as unknown as ObjectDTO
    const props = objectToTemplateInput(withDeleted, { name: 'T' }).properties!
    expect(props).toHaveLength(1)
    expect(props[0].key).toBe('kept')
    expect(props[0].values).toHaveLength(1)
    expect(props[0].values![0].ref).toBe('v3')
  })

  it('omits properties entirely when the object has none', () => {
    const bare = { id: 'o', name: 'n', properties: [] } as unknown as ObjectDTO
    expect(objectToTemplateInput(bare, { name: 'T' })).toEqual({
      type: 'object',
      name: 'T',
    })
  })
})

// ── process templates ─────────────────────────────────────────────────────────

const PROCESS_TEMPLATE = {
  ...TEMPLATE,
  id: 'tpl-2',
  type: 'process',
  name: 'Smelt run',
  inputs: [
    {
      id: 'f1',
      ref: 'obj-scrap',
      properties: [
        {
          id: 'fp1',
          key: 'quantity',
          values: [{ id: 'fv1', data: '800 kg', source: 'authored' }],
        },
      ],
    },
    // No ref: a SLOT, filled when the template is applied.
    { id: 'f2', properties: [] },
  ],
  outputs: [{ id: 'f3', ref: 'obj-billet', properties: [] }],
} as unknown as TemplateDTO

describe('process templates', () => {
  it('carries flows into the draft', () => {
    const draft = templateToDraft(PROCESS_TEMPLATE)

    expect(draft.inputs).toHaveLength(2)
    expect(draft.outputs).toHaveLength(1)
    expect(draft.inputs?.[0].ref).toBe('obj-scrap')
  })

  it('keeps a ref-less flow as an empty slot rather than dropping it', () => {
    // A template flow's ref is a SUGGESTION — "one input goes here" is the shape being described.
    // Dropping it would quietly reduce the template's arity on the next save.
    const draft = templateToDraft(PROCESS_TEMPLATE)

    expect(draft.inputs?.[1].ref).toBe('')
  })

  it('carries a flow property through the round trip', () => {
    const draft = templateToDraft(PROCESS_TEMPLATE)
    const body = buildCreateTemplateInput(draft, 'process')

    expect(body.inputs?.[0].properties?.[0].key).toBe('quantity')
  })

  it('does not load flow bags onto an object template', () => {
    // The replace model writes what the draft holds, so empty bags on an object template would be a
    // write of nothing over nothing — and would misrepresent the type.
    const draft = templateToDraft(TEMPLATE)

    expect(draft.inputs).toBeUndefined()
    expect(draft.outputs).toBeUndefined()
  })

  it('sends the type on create', () => {
    const draft = templateToDraft(PROCESS_TEMPLATE)

    expect(buildCreateTemplateInput(draft, 'process').type).toBe('process')
    expect(buildCreateTemplateInput(draft).type).toBe('object')
  })

  it('omits ref for a slot rather than sending an empty string', () => {
    // '' is not an id. The field is optional, so absent is the honest encoding.
    const body = buildCreateTemplateInput(
      templateToDraft(PROCESS_TEMPLATE),
      'process'
    )

    expect(body.inputs?.[1]).not.toHaveProperty('ref')
    expect(body.inputs?.[0].ref).toBe('obj-scrap')
  })

  it('never sends flows for an object template', () => {
    const body = buildCreateTemplateInput(templateToDraft(TEMPLATE), 'object')

    expect(body).not.toHaveProperty('inputs')
    expect(body).not.toHaveProperty('outputs')
  })

  it('omits flows from the update body when nothing changed', () => {
    const draft = templateToDraft(PROCESS_TEMPLATE)
    const body = buildUpdateTemplateBody(PROCESS_TEMPLATE, draft)

    expect(body).not.toHaveProperty('inputs')
    expect(body).not.toHaveProperty('outputs')
  })

  it('sends the whole bag when one flow changed', () => {
    // Replacement, not diff: a changed bag is re-sent entire.
    const draft = templateToDraft(PROCESS_TEMPLATE)
    draft.inputs = [...(draft.inputs ?? []), { ref: 'obj-ore', properties: [] }]

    const body = buildUpdateTemplateBody(PROCESS_TEMPLATE, draft)
    expect(body.inputs).toHaveLength(3)
    expect(body).not.toHaveProperty('outputs')
  })

  it('does not touch flows when updating an object template', () => {
    const draft = templateToDraft(TEMPLATE)
    draft.name = 'Renamed'

    const body = buildUpdateTemplateBody(TEMPLATE, draft)
    expect(body.name).toBe('Renamed')
    expect(body).not.toHaveProperty('inputs')
  })
})
