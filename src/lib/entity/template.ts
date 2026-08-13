// Maps the template sheet form (TemplateDraft) to an io2p template write body.
//
// Templates write by REPLACEMENT, not by diff: `UpdateTemplateBody.properties` and `.files` are plain
// arrays that stand in for the whole collection, where the object PATCH takes per-section
// add/update/remove. So there is no `diffProperties` here — an edited template re-sends its tree, and
// the node re-mints every id.
//
// That re-minting is why `templateToDraft` drops ids and keeps `ref` instead (see below). The
// property/value/file mapping itself is shared with `entity-body`, since the node takes the same
// `PropertyInput` for objects and templates.

import type {
  ObjectDTO,
  TemplateDTO,
  CreateTemplateInput,
  UpdateTemplateBody,
  FileInput,
  CalcInput,
} from 'io2p-client'

import {
  type EntityDraft,
  calcFromProvenance,
  newReferenceInputs,
  readFiles,
  toCreateProperty,
} from './draft'

/**
 * Templates edit the same draft shape as objects, leaving the hierarchy facets unset — which is what
 * lets the property editor and file sections be shared verbatim rather than reimplemented.
 */
export type TemplateDraft = EntityDraft

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  name: '',
  description: null,
  version: null,
  address: null,
  parentIds: [],
  properties: [],
}

/** A process template starts with one slot on each side — the minimum a process needs. */
export const EMPTY_PROCESS_TEMPLATE_DRAFT: TemplateDraft = {
  ...EMPTY_TEMPLATE_DRAFT,
  inputs: [{ ref: '', properties: [] }],
  outputs: [{ ref: '', properties: [] }],
}

/**
 * Load a template into an editable draft.
 *
 * Ids are deliberately NOT carried over. A template save replaces the whole tree, so every property
 * and value id the read returned stops existing the moment it is written — keeping them would leave
 * the UI holding stale ids and would make the draft look like it can soft-delete a row, which the
 * replace model cannot express.
 *
 * Each value instead keeps its client `ref` — the temp-id the UI minted when the template was first
 * written, which the node stores verbatim on template values precisely so a sibling calc can keep
 * referencing it (E-2). A calc arg points at THAT ref, not at the server id, so rewriting refs to ids
 * would dangle every binding on the first edit. `v.id` is only a fallback for a value that predates
 * refs (a seeded template), where nothing can bind to it anyway.
 *
 * `calc` is carried through for the same reason. A template stores its formula recipe INERT
 * (`source:'derived'` + `calc`, no `num`/`provenance` — it computes only when the template is applied
 * to a real entity). Dropping it here would load a bound value as a blank authored one and, on the
 * next save, REPLACE the recipe with that blank — losing the formula with nothing on screen to
 * suggest it happened.
 */
export function templateToDraft(dto: TemplateDTO): TemplateDraft {
  const draft: TemplateDraft = {
    name: dto.name,
    description: dto.description ?? null,
    version: dto.version ?? null,
    address: null,
    parentIds: [],
    files: readFiles(dto.files),
    properties: (dto.properties ?? []).map(propertyToDraft),
  }

  // Only for a process template. Loading empty bags onto an object template would compare as
  // "flows removed" and send `inputs: []` — harmless today, but it is the replace model's classic
  // way of destroying something the editor never showed.
  if (dto.type === 'process') {
    draft.inputs = (dto.inputs ?? []).map(flowToDraft)
    draft.outputs = (dto.outputs ?? []).map(flowToDraft)
  }

  return draft
}

type TemplateProperty = NonNullable<TemplateDTO['properties']>[number]
type TemplateFlow = NonNullable<TemplateDTO['inputs']>[number]

function propertyToDraft(p: TemplateProperty) {
  return {
    key: p.key,
    label: p.label,
    description: p.description,
    files: readFiles(p.files),
    values: p.values.map((v) => ({
      ref: v.ref ?? v.id,
      data: v.data,
      calc: v.calc,
      files: readFiles(v.files),
    })),
  }
}

/**
 * A template flow's `ref` is OPTIONAL — it is a suggested default, not a target. The user picks the
 * real object when the template is applied, so an empty ref is a legitimate slot rather than an
 * unfinished row, and must survive the round trip as one.
 */
function flowToDraft(flow: TemplateFlow) {
  return {
    ref: flow.ref ?? '',
    properties: (flow.properties ?? []).map(propertyToDraft),
  }
}

/** The preset shape a template contributes to a create form — the part `TemplateChoice` exposes. */
export interface TemplatePresetProperty {
  key: string
  label?: string
  description?: string
  values?: { data?: string; ref?: string; calc?: CalcInput }[]
}

/**
 * Copy a template's presets into the properties of a NEW entity. Applying a template is client-side
 * (D70) — this is that copy.
 *
 * Everything on a preset value is carried, not just its text:
 *
 * - **`calc`** is the whole point of a template that holds formulas. It is stored inert (no result,
 *   no provenance) and computes the moment this create lands, so dropping it leaves the user a plain
 *   text box where a formula should be.
 * - **`ref`** is what a calc arg binds to. The node resolves refs WITHIN one request, so the value's
 *   ref and the recipe's arg must travel together and unchanged — re-minting one without rewriting
 *   the other would point the formula at a value this body never declares.
 * - **`data`** is a default the user can overwrite. A preset with no values still yields one empty
 *   value, so the property is editable rather than a header with nothing under it.
 */
export function templatePresetToDraftProperties(
  presets: TemplatePresetProperty[] | undefined
): TemplateDraft['properties'] {
  return (presets ?? []).map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description,
    values: (p.values?.length ? p.values : [{}]).map((v) => ({
      data: v.data ?? '',
      // A template written before refs existed has none; mint one so a formula can still bind here.
      ref: v.ref ?? crypto.randomUUID(),
      ...(v.calc ? { calc: v.calc } : {}),
    })),
  }))
}

/**
 * Turn an authored value into a template PLACEHOLDER.
 *
 * A template is a starting point, not a copy of one object's measurements — but it also has to keep
 * working. A formula binds to sibling values and computes over numbers, so whatever we substitute
 * must still read as a number, and the old `'Variable'` string did not: it made every mapped sibling
 * unbindable, silently breaking the recipe the template was carrying.
 *
 * So: keep the shape, drop the reading. `3.5 m` → `0 m` (numeric, unit and dimension preserved, and
 * obviously a placeholder). Anything without a leading number is instance data — a barcode, a serial,
 * a supplier — and becomes empty rather than being shared by every object made from this template.
 */
export function placeholderValue(data: string | undefined): string {
  const text = (data ?? '').trim()
  // Leading number + optional unit. Anything else is text we shouldn't carry.
  const match = /^[+-]?\d[\d\s,]*(?:\.\d+)?\s*(.*)$/.exec(text)
  if (!match) return ''
  const unit = match[1].trim()
  return unit ? `0 ${unit}` : '0'
}

/**
 * Build a template from an existing object — the "create template from this object" action.
 *
 * Every value keeps `ref` = the SOURCE VALUE'S ID. That looks odd until you see why: a derived value's
 * recipe names its inputs by those same ids, so reusing them as the template's client refs makes the
 * recipe and the values it references consistent inside one create body, which is what the node
 * resolves against. Minting new refs would require rewriting every arg in lockstep.
 *
 * A derived value contributes its RECIPE, not its computed result — the template recomputes when it
 * is applied. A recipe we cannot express (an inline expression) is skipped entirely rather than
 * downgraded to a stale number pretending to be authored.
 */
export function objectToTemplateInput(
  source: ObjectDTO,
  meta: { name: string; description?: string; version?: string }
): CreateTemplateInput {
  const body: CreateTemplateInput = { type: 'object', name: meta.name }
  if (meta.description) body.description = meta.description
  if (meta.version) body.version = meta.version

  const props = (source.properties ?? [])
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map((p) => {
      const values = p.values
        .filter((v) => !v.deleted)
        .map((v) => {
          if (v.source === 'derived') {
            if (!v.provenance) return null
            const hydrated = calcFromProvenance(v.provenance)
            return hydrated.ok
              ? { ref: v.id, calc: hydrated.calc }
              : // Can't be expressed as a recipe, and its result belongs to the source object.
                null
          }
          return { ref: v.id, data: placeholderValue(v.data) }
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)

      return {
        key: p.key,
        ...(p.label ? { label: p.label } : {}),
        ...(p.description ? { description: p.description } : {}),
        ...(values.length ? { values } : {}),
      }
    })

  if (props.length) body.properties = props
  return body
}

function properties(draft: TemplateDraft) {
  return draft.properties
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)
}

/**
 * The template sheet has NO files UI — io2p cannot make a template an upload target (its attach port
 * routes through the engine registry, which knows only objects and processes), so offering one would
 * be a control that silently discards what it is given.
 *
 * The draft still LOADS `dto.files`, and it must keep doing so. Templates write by replacement, so a
 * draft that dropped them would compare as "files removed" and send `files: []`, wiping any
 * references a template already carries — data loss caused purely by a missing input control. Loading
 * them makes the round-trip faithful: no new references, nothing removed, so `files` is omitted from
 * the body entirely and the server keeps what it has.
 */
function files(draft: TemplateDraft): FileInput[] {
  return newReferenceInputs(draft.files)
}

type TemplateFlowInput = NonNullable<CreateTemplateInput['inputs']>[number]

/**
 * A flow preset, for a process template.
 *
 * `ref` is sent only when the author chose a default object — the field is optional here (unlike a
 * process, where it must point at something that exists), because a template's job is to describe
 * the SHAPE of a process. An empty slot says "one input goes here" and is filled on apply.
 */
function flowInputs(flows: TemplateDraft['inputs']): TemplateFlowInput[] {
  return (flows ?? []).map((flow) => {
    const props = properties({ ...EMPTY_TEMPLATE_DRAFT, ...flow })
    return {
      ...(flow.ref ? { ref: flow.ref } : {}),
      ...(props.length ? { properties: props } : {}),
    }
  })
}

export function buildCreateTemplateInput(
  draft: TemplateDraft,
  type: NonNullable<CreateTemplateInput['type']> = 'object'
): CreateTemplateInput {
  const body: CreateTemplateInput = { type, name: draft.name }
  if (draft.description) body.description = draft.description
  if (draft.version) body.version = draft.version

  const props = properties(draft)
  if (props.length) body.properties = props

  const fs = files(draft)
  if (fs.length) body.files = fs

  if (type === 'process') {
    const inputs = flowInputs(draft.inputs)
    const outputs = flowInputs(draft.outputs)
    if (inputs.length) body.inputs = inputs
    if (outputs.length) body.outputs = outputs
  }

  return body
}

/**
 * An all-unchanged draft returns `{}` (a node no-op). Collections are compared as built bodies rather
 * than field by field: replacement means the only question that matters is whether what we would send
 * differs from what is already there, and a structural compare answers it without a second diff
 * implementation that could disagree with the builder.
 */
export function buildUpdateTemplateBody(
  before: TemplateDTO,
  draft: TemplateDraft
): UpdateTemplateBody {
  const body: UpdateTemplateBody = {}

  if (draft.name !== before.name) body.name = draft.name

  const description = draft.description || undefined
  if (description !== (before.description || undefined)) {
    body.description = description ?? ''
  }

  const version = draft.version || undefined
  if (version !== (before.version || undefined)) body.version = version ?? ''

  const baseline = templateToDraft(before)

  const props = properties(draft)
  if (!sameShape(props, properties(baseline))) body.properties = props

  const fs = files(draft)
  const removedFile = (before.files ?? []).some(
    (f) => !(draft.files ?? []).some((d) => d.id === f.id)
  )
  if (removedFile || !sameShape(fs, files(baseline))) body.files = fs

  // Only for a process template. An object template has no flows to compare, and sending empty bags
  // would be a replace-model write of nothing over nothing.
  if (before.type === 'process') {
    const inputs = flowInputs(draft.inputs)
    if (!sameShape(inputs, flowInputs(baseline.inputs))) body.inputs = inputs

    const outputs = flowInputs(draft.outputs)
    if (!sameShape(outputs, flowInputs(baseline.outputs)))
      body.outputs = outputs
  }

  return body
}

const sameShape = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)
