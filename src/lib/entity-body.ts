// Maps the EntitySheet form (EntityDraft) to an io2p write body: `buildCreateObjectInput` is
// near-identity; `buildUpdateObjectBody` diffs the draft against the loaded entity into the PATCH's
// per-section add/update/remove.
//
// Files split by kind (§18): a `reference` (external url) is authored inline in the body; an `upload`
// is NOT — io2p requires an upload to name an existing target entity, so bytes attach AFTER the entity
// exists via `files.upload(blob, target)`. `resolveUploadTargets` pairs each pending upload with its
// target against the committed object. Removals (either kind) diff by id in the body.

import type {
  ObjectDTO,
  CreateObjectInput,
  UpdateObjectBody,
  ValueInput,
  CalcInput,
  FileInput,
  FileTarget,
} from 'io2p-client'

export type DraftAddress = NonNullable<ObjectDTO['address']>

// The enriched file shape the read model embeds on a value/property/object (presigned urls inline).
type ReadValue = NonNullable<ObjectDTO['properties']>[number]['values'][number]
type ReadFile = NonNullable<ReadValue['files']>[number]

/**
 * A file on the draft. A `reference` carries just its url (+ label) and authors in the body. An
 * `upload` pick arrives as a pending `blob` with NO `id`; it uploads (with a target) after the entity
 * is saved. Existing files (from the read model) carry `id` + display metadata.
 */
export interface DraftFile {
  _localId: string
  id?: string
  kind: 'upload' | 'reference'
  label?: string
  reference?: { url: string }
  /** A not-yet-uploaded pick (kind:'upload' only); attached post-save via resolveUploadTargets. */
  blob?: File
  // Display-only, from the read model (absent on a fresh pick; thumbnails are worker-derived post-save).
  fileName?: string
  contentType?: string
  type?: string
  size?: number
  /** 'ready' once the bytes are stored. A soft-deleted or pending file arrives as a BARE ref. */
  status?: string
  /**
   * Display-only. Comes from the read when it was asked for `includeDeleted`, and is overwritten
   * when THIS session soft-deletes or restores. Never authored into a write body: deleting a file is
   * a files-collection operation, and the entity keeps its reference either way (we detach nothing).
   */
  deleted?: boolean
  thumbnailUrl?: string
  // NOTE: there is deliberately no `downloadUrl`. io2p declares one on the read model but the
  // enricher never fills it (presigned urls are short-lived; inlining them would make the entity
  // response uncacheable). Mint it on demand instead — see `useFileDownload`.
}

export interface DraftValue {
  id?: string
  ref?: string
  data?: string
  calc?: CalcInput | null
  files?: DraftFile[]
}

export interface DraftProperty {
  id?: string
  key: string
  label?: string
  description?: string
  values: DraftValue[]
  files?: DraftFile[]
}

export interface EntityDraft {
  name: string
  description?: string | null
  address?: DraftAddress | null
  parentIds: string[]
  properties: DraftProperty[]
  files?: DraftFile[]
}

// A pending upload (blob, no id yet).
function isPendingUpload(f: DraftFile): boolean {
  return !!f.blob && !f.id
}

// True if the draft carries any pending upload (so submit knows to run the post-save attach step).
export function hasPendingUploads(draft: EntityDraft): boolean {
  const any = (fs?: DraftFile[]) => (fs ?? []).some(isPendingUpload)
  return (
    any(draft.files) ||
    draft.properties.some(
      (p) => any(p.files) || p.values.some((v) => any(v.files))
    )
  )
}

// A read-model file → draft file. Existing files always carry an `id`; `_localId` reuses it so the
// field-array key is stable (a fresh pick gets its own uuid instead).
function readFileToDraft(f: ReadFile): DraftFile {
  return {
    _localId: f.id,
    id: f.id,
    kind: f.kind,
    label: f.label,
    reference: f.reference,
    fileName: f.fileName,
    contentType: f.contentType,
    type: f.type,
    size: f.size,
    status: f.status,
    deleted: f.deleted,
    thumbnailUrl: f.thumbnailUrl,
  }
}

function readFiles(files: ReadFile[] | undefined): DraftFile[] | undefined {
  return files?.length ? files.map(readFileToDraft) : undefined
}

/**
 * The live authored tree. The sheet reads with `includeDeleted` so soft-deleted FILES can render
 * struck-through with a Restore action — but deleted properties and values have no such UI yet, and
 * letting them into the draft would show them as live.
 *
 * Both the draft AND the diff baseline go through here, which is the important part: filtering only
 * the draft would leave deleted items visible to `before`, so every save would re-emit a `remove`
 * for something already deleted.
 */
function liveProperties(dto: ObjectDTO): NonNullable<ObjectDTO['properties']> {
  return (dto.properties ?? [])
    .filter((p) => !p.deleted)
    .map((p) => ({ ...p, values: p.values.filter((v) => !v.deleted) }))
}

// The read half of the round-trip: load an ObjectDTO into an editable draft. Derived values carry
// their computed `data` and keep `calc` unset — so an untouched save is a no-op (diffValues sees no
// data/calc change) and derivation is preserved. Files load at value/property/object level (18.3).
export function dtoToDraft(dto: ObjectDTO): EntityDraft {
  return {
    name: dto.name,
    description: dto.description ?? null,
    address: dto.address ?? null,
    parentIds: (dto.parents ?? []).map((p) => p.id),
    files: readFiles(dto.files),
    properties: liveProperties(dto).map((p) => ({
      id: p.id,
      key: p.key,
      label: p.label,
      description: p.description,
      files: readFiles(p.files),
      values: p.values.map((v) => ({
        id: v.id,
        data: v.data,
        files: readFiles(v.files),
      })),
    })),
  }
}

// A calc is only real once it has a source (a stored formula or an inline expression). A value in
// "formula mode" before a formula is picked (`{ args: [] }`) is NOT a value — the node would 422 it.
function isRealCalc(calc: CalcInput | null | undefined): calc is CalcInput {
  return !!calc && (!!calc.formulaId || !!calc.expression)
}

// A draft file → a body FileInput. ONLY references are body-authored (uploads attach out of band via
// resolveUploadTargets). A new reference needs its url.
function toReferenceInput(f: DraftFile): FileInput | null {
  if (f.kind !== 'reference' || !f.reference?.url) return null
  return {
    kind: 'reference',
    reference: f.reference,
    ...(f.label ? { label: f.label } : {}),
  }
}

function newReferenceInputs(files: DraftFile[] | undefined): FileInput[] {
  return (files ?? [])
    .filter((f) => !f.id) // only NEW files author; existing ones stay put
    .map(toReferenceInput)
    .filter((f): f is FileInput => f !== null)
}

function toCreateValue(v: DraftValue): ValueInput {
  const files = newReferenceInputs(v.files)
  const filesPart = files.length ? { files } : {}
  if (isRealCalc(v.calc)) return { calc: v.calc, ref: v.ref, ...filesPart }
  return { data: v.data ?? '', ref: v.ref, ...filesPart }
}

function toCreateProperty(p: DraftProperty) {
  const values = nonEmptyValues(p.values).map(toCreateValue)
  const files = newReferenceInputs(p.files)
  return {
    key: p.key,
    ...(p.label ? { label: p.label } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(values.length ? { values } : {}),
    ...(files.length ? { files } : {}),
  }
}

// Blank authored values and half-formed calcs aren't real values.
function nonEmptyValues(values: DraftValue[]): DraftValue[] {
  return values.filter(
    (v) => isRealCalc(v.calc) || (v.data ?? '').trim() !== ''
  )
}

export function buildCreateObjectInput(draft: EntityDraft): CreateObjectInput {
  const body: CreateObjectInput = { name: draft.name }
  if (draft.description) body.description = draft.description
  if (draft.address) body.address = draft.address
  if (draft.parentIds.length) body.parents = [...draft.parentIds]

  const properties = draft.properties
    .filter((p) => p.key.trim() !== '')
    .map(toCreateProperty)
  if (properties.length) body.properties = properties

  const files = newReferenceInputs(draft.files)
  if (files.length) body.files = files

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
  const files = newReferenceInputs(v.files)
  const filesPart = files.length ? { files } : {}
  if (isRealCalc(v.calc)) return { calc: v.calc, ref: v.ref, ...filesPart }
  return { data: v.data ?? '', ref: v.ref, ...filesPart }
}

// Body file diff: new REFERENCES are added; files (either kind) present before but gone from the draft
// are removed by id. New uploads are NOT here — they attach post-save (resolveUploadTargets).
type FileSections = {
  add?: FileInput[]
  remove?: string[]
  restore?: string[]
}
/**
 * Body `remove` is a SOFT delete with a `restore` counterpart, so a removed file is marked, never
 * dropped: the draft keeps it with `deleted: true` and the diff reports the TRANSITION. Dropping a
 * row outright (a pending pick discarded before it ever uploaded) still reads as a removal, which is
 * right — there was nothing stored to preserve.
 */
function diffFiles(
  before: ReadFile[] | undefined,
  after: DraftFile[] | undefined
): FileSections | undefined {
  const afterById = new Map(
    (after ?? []).filter((f) => f.id).map((f) => [f.id as string, f])
  )
  const add = newReferenceInputs(after)
  const remove: string[] = []
  const restore: string[] = []

  for (const prev of before ?? []) {
    const now = afterById.get(prev.id)
    // Gone from the draft entirely, or newly marked deleted.
    if (!now || (now.deleted && !prev.deleted)) remove.push(prev.id)
    else if (prev.deleted && !now.deleted) restore.push(prev.id)
  }

  const sections: FileSections = {}
  if (add.length) sections.add = add
  if (remove.length) sections.remove = remove
  if (restore.length) sections.restore = restore
  return Object.keys(sections).length ? sections : undefined
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
    } else if (isRealCalc(v.calc)) {
      calc = v.calc
    }
    const calcChanged = calc !== undefined
    const files = diffFiles(prev.files, v.files)
    if (!dataChanged && !calcChanged && !files) continue
    update.push({
      id: v.id,
      ...(dataChanged ? { data: v.data } : {}),
      ...(calcChanged ? { calc } : {}),
      ...(files ? { files } : {}),
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
    .map(toCreateProperty)

  const remove = [...beforeById.keys()].filter((id) => !keptIds.has(id))

  const update: NonNullable<UpdateProperties['update']> = []
  for (const p of after) {
    if (!p.id) continue
    const prev = beforeById.get(p.id)
    if (!prev) continue
    const labelChange = scalarChange(prev.label, p.label)
    const descChange = scalarChange(prev.description, p.description)
    const values = diffValues(prev.values, p.values)
    const files = diffFiles(prev.files, p.files)
    if (
      labelChange === undefined &&
      descChange === undefined &&
      !values &&
      !files
    )
      continue
    update.push({
      id: p.id,
      ...(labelChange !== undefined ? { label: labelChange } : {}),
      ...(descChange !== undefined ? { description: descChange } : {}),
      ...(values ? { values } : {}),
      ...(files ? { files } : {}),
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

  // Same live view the draft was built from — otherwise a soft-deleted item would look absent
  // and be re-removed on every save.
  const properties = diffProperties(liveProperties(before), draft.properties)
  if (properties) body.properties = properties

  const files = diffFiles(before.files, draft.files)
  if (files) body.files = files

  return body
}

export interface ResolvedUpload {
  file: DraftFile
  target: FileTarget
}

// After a save, pair each pending upload (a draft file with a blob and no id) with its attach target,
// resolved against the COMMITTED object — io2p requires an upload to name an existing target. A draft
// id is used directly; a new property/value borrows its id from `committed` (property by key, value by
// authored position). A value whose id can't be resolved falls back to its property target so the file
// still attaches (surfaced at the property level).
export function resolveUploadTargets(
  committed: ObjectDTO,
  draft: EntityDraft
): ResolvedUpload[] {
  const out: ResolvedUpload[] = []
  const entityId = committed.id
  const pending = (files?: DraftFile[]) => (files ?? []).filter(isPendingUpload)

  for (const f of pending(draft.files))
    out.push({ file: f, target: { entityId } })

  const committedProps = committed.properties ?? []
  for (const p of draft.properties) {
    if (p.key.trim() === '') continue
    const cp = p.id
      ? committedProps.find((x) => x.id === p.id)
      : committedProps.find((x) => x.key === p.key)
    const propertyId = p.id ?? cp?.id
    if (!propertyId) continue // couldn't resolve — the file stays pending, surfaced on reload

    for (const f of pending(p.files)) {
      out.push({ file: f, target: { entityId, propertyId } })
    }

    nonEmptyValues(p.values).forEach((v, i) => {
      const valueId = v.id ?? cp?.values?.[i]?.id
      const target: FileTarget = valueId
        ? { entityId, propertyId, valueId }
        : { entityId, propertyId }
      for (const f of pending(v.files)) out.push({ file: f, target })
    })
  }
  return out
}

/**
 * Index of the first property that has content but no key. io2p requires a key, and a nameless
 * property is silently dropped by the builders — so the user would "save" work that never persists.
 * Returns -1 when the draft is clean.
 */
export function findEmptyPropertyKey(draft: EntityDraft): number {
  return draft.properties.findIndex((p) => {
    if (p.key.trim() !== '') return false
    const hasValue = p.values.some(
      (v) => (v.data ?? '').trim() !== '' || v.calc
    )
    return hasValue || (p.files?.length ?? 0) > 0
  })
}
