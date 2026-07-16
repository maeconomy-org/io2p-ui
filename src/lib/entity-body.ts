/**
 * The L2b write-body builder — the keystone of the data-layer redesign (see internal-docs §12).
 *
 * io2p-core takes ONE write body per entity: `POST` a whole `CreateObjectInput`, `PATCH` a DIFF
 * (`UpdateObjectBody`) that carries only what changed as per-section `add`/`update`/`remove`. So "how do I
 * save an edit" is a pure function of (loaded entity, edited draft) — no per-facet mutation hooks, no
 * statement/calc choreography. `buildUpdateObjectBody` computes that diff; `buildCreateObjectInput` is
 * near-identity. Both are shared by the objects and processes editors.
 *
 * SCOPE (v1): scalars (name/description/address), parents, properties, and values (authored `data` XOR a
 * derived `calc`). FILE add/remove diffing is deferred to the files/upload vertical (plan §4) — files ride
 * the init→PUT→complete flow — so the draft carries no per-value file edits yet.
 */

import type {
  ObjectDTO,
  CreateObjectInput,
  UpdateObjectBody,
  ValueInput,
  CalcInput,
} from '@/types/iom'

/** The editable address surface (the structured field on the entity). */
export type DraftAddress = NonNullable<ObjectDTO['address']>

/** A value in the editor: existing (`id`) or new; authored (`data`) or derived (`calc`). */
export interface DraftValue {
  /** Present = existing value (from the loaded entity); absent = new. */
  id?: string
  /** Client temp-id for THIS request only, so a sibling calc can bind to a new value via `ref`. */
  ref?: string
  /** Authored string. */
  data?: string
  /** Derived recipe; `null` on an existing value reverts it to authored (requires `data`). */
  calc?: CalcInput | null
}

/** A property in the editor: existing (`id`) or new; a bucket of values. */
export interface DraftProperty {
  /** Present = existing property; absent = new (server mints the id). */
  id?: string
  key: string
  label?: string
  description?: string
  values: DraftValue[]
}

/** The canonical entity form shape the EntitySheet edits (plan §13) and the builder maps from. */
export interface EntityDraft {
  name: string
  description?: string | null
  address?: DraftAddress | null
  /** Parent object ids (a DAG; multi-parent allowed). */
  parentIds: string[]
  properties: DraftProperty[]
}

// ── create (near-identity: strip empties, brand each value data XOR calc) ─────────────────────────

function toCreateValue(v: DraftValue): ValueInput {
  // A create value is `data` XOR `calc` (branded union — never both, never neither).
  if (v.calc) return { calc: v.calc, ref: v.ref }
  return { data: v.data ?? '', ref: v.ref }
}

/** Drop values that are blank AND non-derived — an empty authored row is not a real value. */
function nonEmptyValues(values: DraftValue[]): DraftValue[] {
  return values.filter((v) => v.calc || (v.data ?? '').trim() !== '')
}

export function buildCreateObjectInput(draft: EntityDraft): CreateObjectInput {
  const body: CreateObjectInput = { name: draft.name }
  if (draft.description) body.description = draft.description
  if (draft.address) body.address = draft.address
  if (draft.parentIds.length) body.parents = [...draft.parentIds]

  const properties = draft.properties
    .map((p) => {
      const values = nonEmptyValues(p.values).map(toCreateValue)
      return {
        key: p.key,
        ...(p.label ? { label: p.label } : {}),
        ...(p.description ? { description: p.description } : {}),
        ...(values.length ? { values } : {}),
      }
    })
    .filter((p) => p.key.trim() !== '')
  if (properties.length) body.properties = properties

  return body
}

// ── update (the diff) ─────────────────────────────────────────────────────────────────────────────

/** `null` clears an optional scalar, `undefined` leaves it unchanged; normalize empty string → cleared. */
function scalarChange(
  before: string | null | undefined,
  after: string | null | undefined
): string | null | undefined {
  const b = before ?? null
  const a = after === '' ? null : (after ?? null)
  if (a === b) return undefined // unchanged → omit
  return a // new value, or null to clear
}

/** Shallow-equal two addresses over the fields the editor exposes. */
function addressEqual(
  a: DraftAddress | null | undefined,
  b: DraftAddress | null | undefined
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const keys: (keyof DraftAddress)[] = [
    'street',
    'houseNumber',
    'postalCode',
    'city',
    'country',
    'state',
    'district',
    'fullAddress',
    'lat',
    'lng',
  ]
  return keys.every((k) => (a[k] ?? undefined) === (b[k] ?? undefined))
}

type UpdateProperties = NonNullable<UpdateObjectBody['properties']>
type PropertyUpdate = NonNullable<UpdateProperties['update']>[number]
type ValueSections = NonNullable<PropertyUpdate['values']>
type ValueAdd = NonNullable<ValueSections['add']>[number]

function toAddValue(v: DraftValue): ValueAdd {
  if (v.calc) return { calc: v.calc, ref: v.ref }
  return { data: v.data ?? '', ref: v.ref }
}

/** Diff a property's values: new → add, dropped ids → remove, existing with changed data/calc → update. */
function diffValues(
  before: NonNullable<ObjectDTO['properties']>[number]['values'],
  after: DraftValue[]
): ValueSections | undefined {
  const beforeById = new Map(before.map((v) => [v.id, v]))
  const keptIds = new Set(after.filter((v) => v.id).map((v) => v.id as string))

  const add = nonEmptyValues(after.filter((v) => !v.id)).map(toAddValue)
  const remove = [...beforeById.keys()].filter((id) => !keptIds.has(id))

  const update: NonNullable<ValueSections['update']> = []
  for (const v of after) {
    if (!v.id) continue
    const prev = beforeById.get(v.id)
    if (!prev) continue
    const dataChanged = v.data !== undefined && v.data !== prev.data
    // The read model exposes no calc recipe, only `source`. A recipe is always a (re)bind; an explicit
    // `null` reverts derived→authored (a change only if it WAS derived); `undefined` leaves it be.
    let calc: CalcInput | null | undefined
    if (v.calc === null) {
      if (prev.source === 'derived') calc = null
    } else if (v.calc) {
      calc = v.calc
    }
    const calcChanged = calc !== undefined
    if (!dataChanged && !calcChanged) continue
    update.push({
      id: v.id,
      ...(dataChanged ? { data: v.data } : {}),
      ...(calcChanged ? { calc } : {}),
    })
  }

  const sections: ValueSections = {}
  if (add.length) sections.add = add
  if (update.length) sections.update = update
  if (remove.length) sections.remove = remove
  return Object.keys(sections).length ? sections : undefined
}

function diffProperties(
  before: ObjectDTO['properties'],
  after: DraftProperty[]
): UpdateProperties | undefined {
  const beforeById = new Map((before ?? []).map((p) => [p.id, p]))
  const keptIds = new Set(after.filter((p) => p.id).map((p) => p.id as string))

  const add = after
    .filter((p) => !p.id && p.key.trim() !== '')
    .map((p) => {
      const values = nonEmptyValues(p.values).map(toCreateValue)
      return {
        key: p.key,
        ...(p.label ? { label: p.label } : {}),
        ...(p.description ? { description: p.description } : {}),
        ...(values.length ? { values } : {}),
      }
    })

  const remove = [...beforeById.keys()].filter((id) => !keptIds.has(id))

  const update: NonNullable<UpdateProperties['update']> = []
  for (const p of after) {
    if (!p.id) continue
    const prev = beforeById.get(p.id)
    if (!prev) continue
    const labelChange = scalarChange(prev.label, p.label)
    const descChange = scalarChange(prev.description, p.description)
    const values = diffValues(prev.values, p.values)
    if (labelChange === undefined && descChange === undefined && !values)
      continue
    update.push({
      id: p.id,
      ...(labelChange !== undefined ? { label: labelChange } : {}),
      ...(descChange !== undefined ? { description: descChange } : {}),
      ...(values ? { values } : {}),
    })
  }

  const sections: UpdateProperties = {}
  if (add.length) sections.add = add
  if (update.length) sections.update = update
  if (remove.length) sections.remove = remove
  return Object.keys(sections).length ? sections : undefined
}

/**
 * Diff a loaded entity against the edited draft into a minimal PATCH body. An all-unchanged draft returns
 * `{}` (the node treats it as a no-op). Callers pass `if-match` = `before.currentVersion` for optimistic
 * concurrency via `UpdateOptions.ifMatch`.
 */
export function buildUpdateObjectBody(
  before: ObjectDTO,
  draft: EntityDraft
): UpdateObjectBody {
  const body: UpdateObjectBody = {}

  if (draft.name !== before.name) body.name = draft.name

  const desc = scalarChange(before.description, draft.description)
  if (desc !== undefined) body.description = desc

  if (!addressEqual(before.address, draft.address)) {
    body.address = draft.address ?? null
  }

  const beforeParents = (before.parents ?? []).map((p) => p.id)
  const beforeSet = new Set(beforeParents)
  const draftSet = new Set(draft.parentIds)
  const addParents = draft.parentIds.filter((id) => !beforeSet.has(id))
  const removeParents = beforeParents.filter((id) => !draftSet.has(id))
  if (addParents.length || removeParents.length) {
    body.parents = {
      ...(addParents.length ? { add: addParents } : {}),
      ...(removeParents.length ? { remove: removeParents } : {}),
    }
  }

  const properties = diffProperties(before.properties, draft.properties)
  if (properties) body.properties = properties

  return body
}
