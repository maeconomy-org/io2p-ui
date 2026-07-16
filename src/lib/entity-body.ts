// Maps the EntitySheet form (EntityDraft) to an io2p write body: `buildCreateObjectInput` is
// near-identity; `buildUpdateObjectBody` diffs the draft against the loaded entity into the PATCH's
// per-section add/update/remove. File diffing is deferred to the files/upload vertical (plan §4).

import type {
  ObjectDTO,
  CreateObjectInput,
  UpdateObjectBody,
  ValueInput,
  CalcInput,
} from '@/types/iom'

export type DraftAddress = NonNullable<ObjectDTO['address']>

export interface DraftValue {
  id?: string
  ref?: string
  data?: string
  calc?: CalcInput | null
}

export interface DraftProperty {
  id?: string
  key: string
  label?: string
  description?: string
  values: DraftValue[]
}

export interface EntityDraft {
  name: string
  description?: string | null
  address?: DraftAddress | null
  parentIds: string[]
  properties: DraftProperty[]
}

function toCreateValue(v: DraftValue): ValueInput {
  if (v.calc) return { calc: v.calc, ref: v.ref }
  return { data: v.data ?? '', ref: v.ref }
}

// Blank, non-derived values aren't real values.
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

// Returns `undefined` (omit — unchanged), `null` (clear), or the new value. Empty string clears.
function scalarChange(
  before: string | null | undefined,
  after: string | null | undefined
): string | null | undefined {
  const b = before ?? null
  const a = after === '' ? null : (after ?? null)
  if (a === b) return undefined
  return a
}

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
    // We key calc changes on `source`, not a recipe compare: the read model DOES carry the recipe
    // (`value.provenance`), but its args are RESOLVED (valueId/constantId) whereas an editable `calc`
    // uses temp `ref`/constant-name — not field-comparable. So a draft recipe is treated as a (re)bind
    // (the server no-ops an identical one), and `null` reverts derived→authored only if it WAS derived.
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

// An all-unchanged draft returns `{}` (a node no-op). Callers pass if-match = before.currentVersion.
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
