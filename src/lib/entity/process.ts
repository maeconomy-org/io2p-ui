// Maps the process sheet form (EntityDraft with `inputs`/`outputs` set) to an io2p process write
// body. Processes DIFF like objects — `properties`/`files` take the same add/update/remove sections —
// so the object diff helpers are reused verbatim rather than reimplemented. Only flows are new.
//
// Flows are no exception any more: since io2p PR #44 a flow section carries add/update/remove AND
// `restore`, so a removed flow is soft-deleted and recoverable exactly like a property or a file.

import type {
  ProcessDTO,
  CreateProcessInput,
  UpdateProcessBody,
} from 'io2p-client'

import {
  type DraftFlow,
  type EntityDraft,
  type DraftProperty,
  type ResolvedUpload,
  containerUploads,
  diffDeleted,
  diffFiles,
  diffProperties,
  newReferenceInputs,
  readFiles,
  scalarChange,
  toCreateProperty,
} from './draft'

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
    deleted: flow.deleted,
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
  body.inputs = (draft.inputs ?? []).filter(isLiveFlow).map(toCreateFlow)
  body.outputs = (draft.outputs ?? []).filter(isLiveFlow).map(toCreateFlow)

  return body
}

const hasRef = (flow: DraftFlow) => flow.ref.trim() !== ''

// A create has nothing to soft-delete against, so a flow marked deleted in the draft is simply not sent.
const isLiveFlow = (flow: DraftFlow) => hasRef(flow) && !flow.deleted

type FlowSections = NonNullable<UpdateProcessBody['inputs']>

/**
 * Diff one flow bag — the SAME soft-delete discipline properties and files use, via `diffDeleted`.
 *
 * A removed flow is marked `deleted` on the draft rather than dropped from it, so the diff can tell
 * "deleted just now" from "was already deleted" and a restore has something to restore. Dropping it
 * would work for the delete and make Restore impossible, which is exactly the shape this replaced.
 *
 * `ref` is sent only when it actually changed: a re-emitted `link` retargets the flow IN PLACE,
 * keeping its own data, so an unchanged ref would be a pointless write.
 */
function diffFlows(
  before: ReadFlow[] | undefined,
  after: DraftFlow[] | undefined
): FlowSections | undefined {
  const withRef = (after ?? []).filter(hasRef)
  const beforeList = before ?? []
  const beforeById = new Map(beforeList.map((f) => [f.id, f]))

  const add = withRef.filter((f) => !f.id && !f.deleted).map(toCreateFlow)

  const { remove, restore } = diffDeleted(beforeList, withRef)

  const update: NonNullable<FlowSections['update']> = []
  for (const flow of withRef) {
    // A deleted flow takes no edits — same rule as a deleted property.
    if (!flow.id || flow.deleted) continue
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
  if (restore.length) sections.restore = restore
  return Object.keys(sections).length ? sections : undefined
}

/**
 * The direction a save would leave with no live flow, or null.
 *
 * Since PR #44 the node rejects emptying a side (422) — a process with no inputs or no outputs is not
 * a transformation. Caught here so the sheet can say which side and keep the user's other edits,
 * rather than surfacing a server error after a failed round trip.
 */
export function findEmptiedDirection(
  draft: EntityDraft
): 'inputs' | 'outputs' | null {
  for (const bag of ['inputs', 'outputs'] as const) {
    const live = (draft[bag] ?? []).filter((f) => hasRef(f) && !f.deleted)
    if (live.length === 0) return bag
  }
  return null
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
 * Pair every pending pick on a saved process with its attach target, flows included.
 *
 * io2p addresses a flow's files by narrowing the target with `flow: {direction, flowId}` — the same
 * shape as an entity's, one level in — so each flow reuses the shared container walk rather than
 * getting its own resolver.
 *
 * A flow the user just added has no id yet, so it borrows one from the committed process by `ref`.
 * Two flows may legitimately point at the SAME object, so each committed flow is claimed at most once
 * — matching purely by ref would otherwise send both flows' files to whichever matched first.
 */
export function resolveProcessUploadTargets(
  committed: ProcessDTO,
  draft: EntityDraft
): ResolvedUpload[] {
  const entityId = committed.id
  const out = containerUploads(
    { entityId },
    committed.properties,
    draft.properties,
    draft.files
  )

  const bags = [
    { direction: 'input' as const, key: 'inputs' as const },
    { direction: 'output' as const, key: 'outputs' as const },
  ]

  for (const { direction, key } of bags) {
    const committedFlows = committed[key] ?? []
    const claimed = new Set<string>()

    for (const flow of draft[key] ?? []) {
      if (!hasRef(flow)) continue
      const match = flow.id
        ? committedFlows.find((f) => f.id === flow.id)
        : committedFlows.find((f) => f.ref === flow.ref && !claimed.has(f.id))
      const flowId = flow.id ?? match?.id
      if (!flowId) continue // unresolvable — the pick stays local, visible again on reload
      claimed.add(flowId)

      out.push(
        ...containerUploads(
          { entityId, flow: { direction, flowId } },
          match?.properties ?? [],
          flow.properties,
          flow.files
        )
      )
    }
  }

  return out
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
