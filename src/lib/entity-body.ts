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

import type { UploadTask } from '@/lib/upload-queue'

export type DraftAddress = NonNullable<ObjectDTO['address']>

// The enriched file shape the read model embeds on a value/property/object (presigned urls inline).
type ReadValue = NonNullable<ObjectDTO['properties']>[number]['values'][number]
type ReadFile = NonNullable<ReadValue['files']>[number]

/**
 * A derived value's calc recipe plus its evaluation trace — the frozen expression, what each variable
 * was bound to, the number it contributed, and any error. Projection-only: the node computes it, we
 * never author it. It is deliberately NOT on `DraftValue`, which is the editable contract.
 */
export type ValueProvenance = NonNullable<ReadValue['provenance']>

/** The normalizer's verdict on a value: whether it found a number, and why not if it didn't. */
export type ValueParse = NonNullable<ReadValue['parse']>

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
  /**
   * Normalizer output — DISPLAY ONLY, never authored. `num`/`unit` are the canonical form the node
   * actually computes over ("2 t" -> 2000 kg); `parse` says whether it managed, and `parse.ok:false`
   * is the reason a value is silently excluded from formulas and totals.
   */
  num?: number
  unit?: string
  parse?: ValueParse
  /**
   * Soft-deleted. Arrives from a read asked for `includeDeleted`, and is set when THIS session
   * removes it. Removing an existing value MARKS it — nothing is dropped from the draft, so the
   * diff can tell "deleted just now" from "was already deleted" and Restore stays available.
   */
  deleted?: boolean
}

export interface DraftProperty {
  id?: string
  key: string
  label?: string
  description?: string
  values: DraftValue[]
  files?: DraftFile[]
  /** Soft-deleted — see DraftValue.deleted. */
  deleted?: boolean
}

/**
 * A process input or output: a directed edge to an existing object that carries its OWN authored
 * data. Quantity is not a field here and never will be — io2p keeps domain semantics above the
 * protocol (D67), so a quantity is an ordinary property on the flow, keyed by `QUANTITY_KEY`.
 *
 * There is deliberately NO `deleted` flag, unlike properties/values/files. Removing a flow emits
 * `unlink`, which HARD-splices it and its whole data subtree out of the projection — there is no
 * restore section for flows. Marking one deleted would imply a reversibility the backend does not
 * offer, so a removed flow simply leaves the draft and the UI confirms first.
 */
export interface DraftFlow {
  /** Server-minted; absent on a flow the user just added. */
  id?: string
  /** The object this flow points at. Retargeting keeps the flow's own data. */
  ref: string
  /** Resolved display name from the read model — never written back. */
  refName?: string
  properties: DraftProperty[]
  files?: DraftFile[]
}

/**
 * The form contract every entity sheet edits. Facets that only some entity kinds have are optional
 * and simply left unset by the others: templates have no hierarchy or address, objects have no
 * authored `version` (io2p removed that concept from objects — the sheet shows `currentVersion`,
 * the server's write counter, which is a different thing and never authored), and only processes
 * have flows.
 *
 * One shape rather than one per kind is what lets the property editor, the file sections and the
 * metadata fields be written once and reused across objects, templates and processes.
 */
export interface EntityDraft {
  name: string
  description?: string | null
  address?: DraftAddress | null
  parentIds: string[]
  properties: DraftProperty[]
  files?: DraftFile[]
  /** Templates only: an authored label like "1.0". */
  version?: string | null
  /** Processes only. A process requires at least one of each — the node rejects an empty bag. */
  inputs?: DraftFlow[]
  outputs?: DraftFlow[]
}

// A pending upload (blob, no id yet).
function isPendingUpload(f: DraftFile): boolean {
  return !!f.blob && !f.id
}

// True if the draft carries any pending upload (so submit knows to run the post-save attach step).
export function hasPendingUploads(draft: EntityDraft): boolean {
  const any = (fs?: DraftFile[]) => (fs ?? []).some(isPendingUpload)
  // A deleted branch attaches nothing (resolveUploadTargets skips it), so counting it here would
  // only buy a pointless re-fetch of the committed tree.
  return (
    any(draft.files) ||
    draft.properties.some(
      (p) =>
        !p.deleted &&
        (any(p.files) || p.values.some((v) => !v.deleted && any(v.files)))
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

export function readFiles(
  files: ReadFile[] | undefined
): DraftFile[] | undefined {
  return files?.length ? files.map(readFileToDraft) : undefined
}

// The read half of the round-trip: load an ObjectDTO into an editable draft. Derived values carry
// their computed `data` and keep `calc` unset — so an untouched save is a no-op (diffValues sees no
// data/calc change) and derivation is preserved. Files load at value/property/object level (18.3).
//
// The sheet reads with `includeDeleted`, so soft-deleted properties and values come through MARKED
// rather than filtered — they render struck-through with a Restore action, and the diff compares the
// deleted flag on both sides. Filtering either side alone would make every save re-remove them.
export function dtoToDraft(dto: ObjectDTO): EntityDraft {
  return {
    name: dto.name,
    description: dto.description ?? null,
    address: dto.address ?? null,
    parentIds: (dto.parents ?? []).map((p) => p.id),
    files: readFiles(dto.files),
    properties: (dto.properties ?? []).map((p) => ({
      id: p.id,
      key: p.key,
      label: p.label,
      description: p.description,
      deleted: p.deleted,
      files: readFiles(p.files),
      values: p.values.map((v) => ({
        id: v.id,
        data: v.data,
        deleted: v.deleted,
        num: v.num,
        unit: v.unit,
        parse: v.parse,
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

export function newReferenceInputs(
  files: DraftFile[] | undefined
): FileInput[] {
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

export function toCreateProperty(p: DraftProperty) {
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

// Blank authored values, half-formed calcs and deleted rows aren't real values.
function nonEmptyValues(values: DraftValue[]): DraftValue[] {
  return values.filter(
    (v) => !v.deleted && (isRealCalc(v.calc) || (v.data ?? '').trim() !== '')
  )
}

export function buildCreateObjectInput(draft: EntityDraft): CreateObjectInput {
  const body: CreateObjectInput = { name: draft.name }
  if (draft.description) body.description = draft.description
  if (draft.address) body.address = draft.address
  if (draft.parentIds.length) body.parents = [...draft.parentIds]

  const properties = draft.properties
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)
  if (properties.length) body.properties = properties

  const files = newReferenceInputs(draft.files)
  if (files.length) body.files = files

  return body
}

// Returns `undefined` (omit — unchanged), `null` (clear), or the new value. Empty string clears.
export function scalarChange(
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
export function diffFiles(
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

/**
 * Which ids moved into or out of the soft-deleted state. `remove` covers both "marked deleted this
 * session" and "dropped from the draft entirely" — a row that never had an id was never stored, so
 * dropping it is the only way it can disappear.
 */
function diffDeleted<T extends { id?: string; deleted?: boolean }>(
  before: { id: string; deleted?: boolean }[],
  after: T[]
): { remove: string[]; restore: string[] } {
  const afterById = new Map(
    after.filter((x) => x.id).map((x) => [x.id as string, x])
  )
  const remove: string[] = []
  const restore: string[] = []
  for (const prev of before) {
    const now = afterById.get(prev.id)
    if (!now || (now.deleted && !prev.deleted)) remove.push(prev.id)
    else if (prev.deleted && !now.deleted) restore.push(prev.id)
  }
  return { remove, restore }
}

function diffValues(
  before: NonNullable<ObjectDTO['properties']>[number]['values'],
  after: DraftValue[]
): ValueSections | undefined {
  const beforeById = new Map(before.map((v) => [v.id, v]))

  const add = nonEmptyValues(after.filter((v) => !v.id && !v.deleted)).map(
    toAddValue
  )
  const { remove, restore } = diffDeleted(before, after)

  const update: NonNullable<ValueSections['update']> = []
  for (const v of after) {
    if (!v.id || v.deleted) continue // a deleted value takes no edits
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
  if (restore.length) sections.restore = restore
  return Object.keys(sections).length ? sections : undefined
}

export function diffProperties(
  before: ObjectDTO['properties'],
  after: DraftProperty[]
): UpdateProperties | undefined {
  const beforeById = new Map((before ?? []).map((p) => [p.id, p]))

  const add = after
    .filter((p) => !p.id && !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)

  const { remove, restore } = diffDeleted(before ?? [], after)

  const update: NonNullable<UpdateProperties['update']> = []
  for (const p of after) {
    if (!p.id || p.deleted) continue // a deleted property takes no edits
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
  if (restore.length) sections.restore = restore
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

  // The full tree, deleted items included — both sides carry the flag, so the diff reports the
  // transition. Filtering either side would make an already-deleted item look absent and be removed
  // again on every save.
  const properties = diffProperties(before.properties, draft.properties)
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
    if (p.deleted || p.key.trim() === '') continue
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

export type CalcHydration =
  | { ok: true; calc: CalcInput }
  | { ok: false; reason: 'inlineExpression' | 'unknownConstant' }

/**
 * Turn a read-only evaluation trace back into an EDITABLE recipe — so a derived value's formula and
 * bindings can be changed instead of being frozen at whatever they were first saved as, and so a
 * template built from an object can carry that object's formulas.
 *
 * The two sides are not symmetric: a trace names its inputs by resolved id, an editable `calc` binds
 * by `ref` (a value id — the node seeds every existing id as its own ref) or by constant NAME, which
 * the trace does not carry. Rather than drop a binding it can't express — the node would then 422 on
 * the missing variable, or worse, silently rebind — this reports WHY it can't and the caller decides.
 */
export function calcFromProvenance(
  provenance: ValueProvenance,
  constantNames: ReadonlyMap<string, string>
): CalcHydration {
  // An inline ad-hoc expression has no formula to select, and the editor picks formulas rather than
  // typing them — offering it would show an empty picker and lose the expression on save.
  if (!provenance.formulaId) return { ok: false, reason: 'inlineExpression' }

  const args: CalcInput['args'] = []
  for (const arg of provenance.args) {
    if (arg.source.kind === 'property') {
      args.push({ var: arg.var, ref: arg.source.valueId })
      continue
    }
    const name = constantNames.get(arg.source.constantId)
    if (!name) return { ok: false, reason: 'unknownConstant' }
    args.push({ var: arg.var, constant: name })
  }
  return { ok: true, calc: { formulaId: provenance.formulaId, args } }
}

/** An upload-queue item before the queue stamps its runtime state onto it. */
export type PendingUploadTask = Omit<
  UploadTask,
  'status' | 'progress' | 'retries' | 'abortController'
>

/**
 * Turn a saved entity plus its draft into the queue items for every pending pick.
 *
 * Kept here, next to `resolveUploadTargets`, because every entity sheet needs exactly this and the
 * mapping is easy to get subtly wrong — see the descriptor below. Building the tasks is pure; the
 * enqueue is the caller's single impure line.
 */
export function buildUploadTasks(
  committed: ObjectDTO,
  draft: EntityDraft
): PendingUploadTask[] {
  return resolveUploadTargets(committed, draft).map(({ file, target }) => {
    const blob = file.blob!
    const fileName = file.fileName ?? blob.name
    const contentType = file.contentType || blob.type || undefined
    return {
      id: crypto.randomUUID(),
      fileName,
      size: blob.size,
      contentType,
      // An explicit descriptor rather than the raw File: the SDK would otherwise read `File.name`,
      // losing a rename. Renaming by rebuilding the File would copy the bytes.
      file: { data: blob, fileName, contentType },
      target,
    }
  })
}

/**
 * Index of the first property that has content but no key. io2p requires a key, and a nameless
 * property is silently dropped by the builders — so the user would "save" work that never persists.
 * Returns -1 when the draft is clean.
 */
export function findEmptyPropertyKey(draft: EntityDraft): number {
  return draft.properties.findIndex((p) => {
    if (p.deleted || p.key.trim() !== '') return false
    const hasValue = p.values.some(
      (v) => (v.data ?? '').trim() !== '' || v.calc
    )
    return hasValue || (p.files?.length ?? 0) > 0
  })
}
