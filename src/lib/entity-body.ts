// Maps the EntitySheet form (EntityDraft) to an io2p write body: `buildCreateObjectInput` is
// near-identity; `buildUpdateObjectBody` diffs the draft against the loaded entity into the PATCH's
// per-section add/update/remove. Files author at value/property/object level; a pending upload's minted
// id is resolved via `fileIdMap` (built at submit time) so these builders stay pure — see plan §18.

import type {
  ObjectDTO,
  CreateObjectInput,
  UpdateObjectBody,
  ValueInput,
  CalcInput,
  FileInput,
} from 'io2p-client'

export type DraftAddress = NonNullable<ObjectDTO['address']>

// The enriched file shape the read model embeds on a value/property/object (presigned urls inline).
type ReadValue = NonNullable<ObjectDTO['properties']>[number]['values'][number]
type ReadFile = NonNullable<ReadValue['files']>[number]

/**
 * A file on the draft. Uploads authored on CREATE arrive as a pending `blob` with NO `id` — the byte
 * upload runs at submit time (lazy), and its minted files-collection id is resolved via `fileIdMap`
 * keyed on `_localId`. Existing files (from the read model) carry `id`. References carry only `reference`.
 */
export interface DraftFile {
  _localId: string
  id?: string
  kind: 'upload' | 'reference'
  label?: string
  reference?: { url: string }
  /** A not-yet-uploaded pick (kind:'upload' only); its id is resolved at submit. */
  blob?: File
  // Display-only, from the read model (absent on a fresh pick; thumbnails are worker-derived post-save).
  fileName?: string
  contentType?: string
  type?: string
  thumbnailUrl?: string
  downloadUrl?: string
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

// Resolves a pending upload's `_localId` to its minted files-collection id (built at submit time).
export type FileIdMap = Map<string, string>

// Every not-yet-uploaded pick across the draft (value/property/object level). Submit uploads these to
// mint ids, then passes the resulting `_localId → id` map to the builders. Kept here (pure) so the
// walk is unit-testable and the builders stay side-effect free.
export function collectPendingUploads(draft: EntityDraft): DraftFile[] {
  const out: DraftFile[] = []
  const scan = (files?: DraftFile[]) => {
    for (const f of files ?? []) if (f.blob && !f.id) out.push(f)
  }
  scan(draft.files)
  for (const p of draft.properties) {
    scan(p.files)
    for (const v of p.values) scan(v.files)
  }
  return out
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
    thumbnailUrl: f.thumbnailUrl,
    downloadUrl: f.downloadUrl,
  }
}

function readFiles(files: ReadFile[] | undefined): DraftFile[] | undefined {
  return files?.length ? files.map(readFileToDraft) : undefined
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
    properties: (dto.properties ?? []).map((p) => ({
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

// A draft file → a create/PATCH FileInput. An upload resolves its minted files-collection id from the
// idMap (keyed on `_localId`) or an already-persisted `id`; a pending upload whose bytes never landed
// (no resolvable id) is dropped. A reference needs a url.
function toFileInput(f: DraftFile, idMap: FileIdMap): FileInput | null {
  if (f.kind === 'reference') {
    if (!f.reference?.url) return null
    return {
      kind: 'reference',
      reference: f.reference,
      ...(f.label ? { label: f.label } : {}),
    }
  }
  const id = f.id ?? idMap.get(f._localId)
  return id
    ? { kind: 'upload', id, ...(f.label ? { label: f.label } : {}) }
    : null
}

function toFileInputs(
  files: DraftFile[] | undefined,
  idMap: FileIdMap
): FileInput[] {
  return (files ?? [])
    .map((f) => toFileInput(f, idMap))
    .filter((f): f is FileInput => f !== null)
}

function toCreateValue(v: DraftValue, idMap: FileIdMap): ValueInput {
  const files = toFileInputs(v.files, idMap)
  const filesPart = files.length ? { files } : {}
  if (isRealCalc(v.calc)) return { calc: v.calc, ref: v.ref, ...filesPart }
  return { data: v.data ?? '', ref: v.ref, ...filesPart }
}

function toCreateProperty(p: DraftProperty, idMap: FileIdMap) {
  const values = nonEmptyValues(p.values).map((v) => toCreateValue(v, idMap))
  const files = toFileInputs(p.files, idMap)
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

export function buildCreateObjectInput(
  draft: EntityDraft,
  fileIdMap: FileIdMap = new Map()
): CreateObjectInput {
  const body: CreateObjectInput = { name: draft.name }
  if (draft.description) body.description = draft.description
  if (draft.address) body.address = draft.address
  if (draft.parentIds.length) body.parents = [...draft.parentIds]

  const properties = draft.properties
    .filter((p) => p.key.trim() !== '')
    .map((p) => toCreateProperty(p, fileIdMap))
  if (properties.length) body.properties = properties

  const files = toFileInputs(draft.files, fileIdMap)
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

function toAddValue(v: DraftValue, idMap: FileIdMap): ValueAdd {
  const files = toFileInputs(v.files, idMap)
  const filesPart = files.length ? { files } : {}
  if (isRealCalc(v.calc)) return { calc: v.calc, ref: v.ref, ...filesPart }
  return { data: v.data ?? '', ref: v.ref, ...filesPart }
}

// Files are add/remove only (never edited): new draft files (no `id`) are added; read-model files
// absent from the draft are removed by id. Returns `undefined` when nothing changed.
type FileSections = { add?: FileInput[]; remove?: string[] }
function diffFiles(
  before: ReadFile[] | undefined,
  after: DraftFile[] | undefined,
  idMap: FileIdMap
): FileSections | undefined {
  const keptIds = new Set(
    (after ?? []).filter((f) => f.id).map((f) => f.id as string)
  )
  const add = (after ?? [])
    .filter((f) => !f.id)
    .map((f) => toFileInput(f, idMap))
    .filter((f): f is FileInput => f !== null)
  const remove = (before ?? [])
    .map((f) => f.id)
    .filter((id) => !keptIds.has(id))

  const sections: FileSections = {}
  if (add.length) sections.add = add
  if (remove.length) sections.remove = remove
  return Object.keys(sections).length ? sections : undefined
}

function diffValues(
  before: NonNullable<ObjectDTO['properties']>[number]['values'],
  after: DraftValue[],
  idMap: FileIdMap
): ValueSections | undefined {
  const beforeById = new Map(before.map((v) => [v.id, v]))
  const keptIds = new Set(after.filter((v) => v.id).map((v) => v.id as string))

  const add = nonEmptyValues(after.filter((v) => !v.id)).map((v) =>
    toAddValue(v, idMap)
  )
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
    const files = diffFiles(prev.files, v.files, idMap)
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
  after: DraftProperty[],
  idMap: FileIdMap
): UpdateProperties | undefined {
  const beforeById = new Map((before ?? []).map((p) => [p.id, p]))
  const keptIds = new Set(after.filter((p) => p.id).map((p) => p.id as string))

  const add = after
    .filter((p) => !p.id && p.key.trim() !== '')
    .map((p) => toCreateProperty(p, idMap))

  const remove = [...beforeById.keys()].filter((id) => !keptIds.has(id))

  const update: NonNullable<UpdateProperties['update']> = []
  for (const p of after) {
    if (!p.id) continue
    const prev = beforeById.get(p.id)
    if (!prev) continue
    const labelChange = scalarChange(prev.label, p.label)
    const descChange = scalarChange(prev.description, p.description)
    const values = diffValues(prev.values, p.values, idMap)
    const files = diffFiles(prev.files, p.files, idMap)
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
  draft: EntityDraft,
  fileIdMap: FileIdMap = new Map()
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

  const properties = diffProperties(
    before.properties,
    draft.properties,
    fileIdMap
  )
  if (properties) body.properties = properties

  const files = diffFiles(before.files, draft.files, fileIdMap)
  if (files) body.files = files

  return body
}
