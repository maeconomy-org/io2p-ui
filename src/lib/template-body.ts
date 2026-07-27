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
  TemplateDTO,
  CreateTemplateInput,
  UpdateTemplateBody,
  FileInput,
} from 'io2p-client'

import {
  type EntityDraft,
  newReferenceInputs,
  readFiles,
  toCreateProperty,
} from './entity-body'

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

/**
 * Load a template into an editable draft.
 *
 * Ids are deliberately NOT carried over. A template save replaces the whole tree, so every property
 * and value id the read returned stops existing the moment it is written — keeping them would leave
 * the UI holding stale ids and would make the draft look like it can soft-delete a row, which the
 * replace model cannot express.
 *
 * Each value instead gets `ref` = its former id. Refs are how a calc binds a sibling within one
 * request, so a formula recipe held by the template keeps pointing at the right value across the
 * replace. Dropping ids without this would silently dangle every binding.
 */
export function templateToDraft(dto: TemplateDTO): TemplateDraft {
  return {
    name: dto.name,
    description: dto.description ?? null,
    version: dto.version ?? null,
    address: null,
    parentIds: [],
    files: readFiles(dto.files),
    properties: (dto.properties ?? []).map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
      files: readFiles(p.files),
      values: p.values.map((v) => ({
        ref: v.id,
        data: v.data,
        files: readFiles(v.files),
      })),
    })),
  }
}

function properties(draft: TemplateDraft) {
  return draft.properties
    .filter((p) => !p.deleted && p.key.trim() !== '')
    .map(toCreateProperty)
}

// Only references author into the body; uploads attach afterwards against the saved template.
function files(draft: TemplateDraft): FileInput[] {
  return newReferenceInputs(draft.files)
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

  return body
}

const sameShape = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)
