// Maps the process sheet form (EntityDraft with `inputs`/`outputs` set) to an io2p process write
// body. Processes DIFF like objects — `properties`/`files` take the same add/update/remove sections —
// so the object diff helpers are reused verbatim rather than reimplemented. Only flows are new.
//
// The one asymmetry: a flow section has add/update/remove but NO `restore`, because `unlink` splices
// the flow out of the projection rather than flagging it. See `DraftFlow` for what that costs the UI.

import type {
  ProcessDTO,
  CreateProcessInput,
  UpdateProcessBody,
} from 'io2p-client'

import {
  type DraftFlow,
  type EntityDraft,
  type DraftProperty,
  diffFiles,
  diffProperties,
  newReferenceInputs,
  readFiles,
  scalarChange,
  toCreateProperty,
} from './entity-body'

/**
 * The property key a flow's quantity lives under.
 *
 * io2p has no quantity field and will not gain one: D67 keeps domain semantics — quantity, mass-loss,
 * the Sankey — ABOVE the protocol, carried as ordinary properties. Core's own fixtures use this exact
 * key. It is a UI convention over a model-agnostic backend, so it lives in one place; never inline
 * the string.
 */
export const QUANTITY_KEY = 'quantity'

export const EMPTY_PROCESS_DRAFT: EntityDraft = {
  name: '',
  description: null,
  address: null,
  parentIds: [],
  properties: [],
  inputs: [],
  outputs: [],
}

type ReadFlow = ProcessDTO['inputs'][number]

function flowToDraft(flow: ReadFlow): DraftFlow {
  return {
    id: flow.id,
    ref: flow.ref,
    refName: flow.refName,
    properties: (flow.properties ?? []).map(propertyToDraft),
    files: readFiles(flow.files),
  }
}

// Same mapping objects use; kept local because the object version is inlined in dtoToDraft.
function propertyToDraft(
  p: NonNullable<ReadFlow['properties']>[number]
): DraftProperty {
  return {
    id: p.id,
    key: p.key,
    label: p.label,
    description: p.description,
    deleted: p.deleted,
    files: readFiles(p.files),
    values: p.values.map((v) => ({
      id: v.id,
      data: v.data,
      source: v.source,
      provenance: v.provenance,
      num: v.num,
      unit: v.unit,
      parse: v.parse,
      deleted: v.deleted,
      files: readFiles(v.files),
    })),
  }
}

export function processToDraft(dto: ProcessDTO): EntityDraft {
  return {
    name: dto.name,
    description: dto.description ?? null,
    address: null,
    parentIds: [],
    files: readFiles(dto.files),
    properties: (dto.properties ?? []).map(propertyToDraft),
    inputs: (dto.inputs ?? []).map(flowToDraft),
    outputs: (dto.outputs ?? []).map(flowToDraft),
  }
}

// A flow contributes only what it actually carries — an empty flow stays exactly `{ ref }`, matching
// the node's absent-until-set discipline.
function toCreateFlow(flow: DraftFlow) {
  const properties = flow.properties
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)
  const files = newReferenceInputs(flow.files)
  return {
    ref: flow.ref,
    ...(properties.length ? { properties } : {}),
    ...(files.length ? { files } : {}),
  }
}

export function buildCreateProcessInput(
  draft: EntityDraft
): CreateProcessInput {
  const body: CreateProcessInput = { name: draft.name }
  if (draft.description) body.description = draft.description

  const properties = draft.properties
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)
  if (properties.length) body.properties = properties

  const files = newReferenceInputs(draft.files)
  if (files.length) body.files = files

  // Always sent, even when empty: the node REQUIRES at least one of each, so an omitted bag is a 422
  // we would rather surface as the validation it is than as a mysterious missing field.
  body.inputs = (draft.inputs ?? []).filter(hasRef).map(toCreateFlow)
  body.outputs = (draft.outputs ?? []).filter(hasRef).map(toCreateFlow)

  return body
}

const hasRef = (flow: DraftFlow) => flow.ref.trim() !== ''

type FlowSections = NonNullable<UpdateProcessBody['inputs']>

/**
 * Diff one flow bag.
 *
 * A flow missing from the draft is an `unlink` — there is no soft-delete to report, so "gone from the
 * draft" is the only signal, and it is irreversible on the server. `ref` is sent only when it
 * actually changed: a re-emitted `link` retargets the flow IN PLACE, keeping its own data, so sending
 * an unchanged ref would be a pointless write.
 */
function diffFlows(
  before: ReadFlow[] | undefined,
  after: DraftFlow[] | undefined
): FlowSections | undefined {
  const live = (after ?? []).filter(hasRef)
  const beforeList = before ?? []
  const beforeById = new Map(beforeList.map((f) => [f.id, f]))
  const afterIds = new Set(live.filter((f) => f.id).map((f) => f.id as string))

  const add = live.filter((f) => !f.id).map(toCreateFlow)
  const remove = beforeList.filter((f) => !afterIds.has(f.id)).map((f) => f.id)

  const update: NonNullable<FlowSections['update']> = []
  for (const flow of live) {
    if (!flow.id) continue
    const prev = beforeById.get(flow.id)
    if (!prev) continue
    const refChange = flow.ref !== prev.ref ? flow.ref : undefined
    // A flow's property bag is optional on the read model but always present on the draft.
    const properties = diffProperties(prev.properties ?? [], flow.properties)
    const files = diffFiles(prev.files, flow.files)
    if (refChange === undefined && !properties && !files) continue
    update.push({
      flowId: flow.id,
      ...(refChange !== undefined ? { ref: refChange } : {}),
      ...(properties ? { properties } : {}),
      ...(files ? { files } : {}),
    })
  }

  const sections: FlowSections = {}
  if (add.length) sections.add = add
  if (update.length) sections.update = update
  if (remove.length) sections.remove = remove
  return Object.keys(sections).length ? sections : undefined
}

/** An all-unchanged draft returns `{}` (a node no-op). Callers pass if-match = before.currentVersion. */
export function buildUpdateProcessBody(
  before: ProcessDTO,
  draft: EntityDraft
): UpdateProcessBody {
  const body: UpdateProcessBody = {}

  if (draft.name !== before.name) body.name = draft.name

  const desc = scalarChange(before.description, draft.description)
  if (desc !== undefined) body.description = desc

  const properties = diffProperties(before.properties, draft.properties)
  if (properties) body.properties = properties

  const files = diffFiles(before.files, draft.files)
  if (files) body.files = files

  const inputs = diffFlows(before.inputs, draft.inputs)
  if (inputs) body.inputs = inputs

  const outputs = diffFlows(before.outputs, draft.outputs)
  if (outputs) body.outputs = outputs

  return body
}

/**
 * Index of the first flow with no target, or -1. The node requires a flow to name an existing object,
 * so a ref-less row would 422 the whole save — better to point at the row than to let the user guess
 * which one the server meant.
 */
export function findFlowWithoutRef(draft: EntityDraft): {
  bag: 'inputs' | 'outputs'
  index: number
} | null {
  for (const bag of ['inputs', 'outputs'] as const) {
    const index = (draft[bag] ?? []).findIndex((f) => !hasRef(f))
    if (index >= 0) return { bag, index }
  }
  return null
}
