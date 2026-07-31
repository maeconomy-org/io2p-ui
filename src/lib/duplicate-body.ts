import type { CreateObjectInput, FileInput, ObjectDTO } from 'io2p-client'

import { buildCreateObjectInput, dtoToDraft } from './entity-body'

export interface DuplicateOptions {
  /** Prepended to the name, e.g. `"Copy of "`. */
  namePrefix?: string
  /** Where the copy lands. Empty means a root object. */
  parentIds?: string[]
  copyProperties?: boolean
  copyFiles?: boolean
  copyAddress?: boolean
}

/**
 * The source's files that can HONESTLY be duplicated — external references only.
 *
 * `buildCreateObjectInput` drops all of them: `newReferenceInputs` keeps only files with no `id`,
 * because editing an object leaves its existing files attached and re-authoring would duplicate the
 * rows. A duplicate is the opposite case, so this re-adds what it safely can.
 *
 * **Uploads are NOT copied, and the create body would happily accept them.** An entity's file field
 * is a JOIN KEY — `entity.rules.ts` checks only that an `upload` carries an id, never that the id
 * exists or is free — while the files collection gives each blob ONE `attachedTo` target. Putting
 * the source's file id on the copy therefore makes two entities point at a blob that still belongs
 * to the first: it renders on both, but a files-by-target read finds it under the original only,
 * and deleting the original takes it from the copy. That is a dangling relationship, not a copy.
 *
 * A `reference` is pure data — a url — so it duplicates cleanly.
 *
 * Copying uploaded bytes needs either a download-and-re-upload round trip or a node-side
 * "attach this blob to another entity" (see the backend asks). Until then the sheet says so.
 */
function fileInputsFrom(source: ObjectDTO): FileInput[] {
  return (source.files ?? [])
    .filter((f) => !f.deleted && f.kind === 'reference' && f.reference?.url)
    .map((f) => ({
      kind: 'reference' as const,
      reference: { url: f.reference!.url },
      label: f.label,
    }))
}

/**
 * One object → the body that recreates it somewhere else.
 *
 * Built on the same `dtoToDraft` → `buildCreateObjectInput` round trip the edit path uses, so a
 * field added to one is carried by the other. Only files need special handling (above).
 *
 * The source's OWN parents are replaced rather than merged: duplicating a first-floor room into the
 * second floor should put the copy on the second floor only, not both.
 */
export function objectToDuplicateInput(
  source: ObjectDTO,
  options: DuplicateOptions = {}
): CreateObjectInput {
  const {
    namePrefix = '',
    parentIds = [],
    copyProperties = true,
    copyFiles = true,
    copyAddress = true,
  } = options

  const draft = dtoToDraft(source)
  draft.name = `${namePrefix}${draft.name}`.trim()
  draft.parentIds = [...parentIds]
  if (!copyProperties) draft.properties = []
  if (!copyAddress) draft.address = null

  const body = buildCreateObjectInput(draft)

  if (copyFiles) {
    const files = fileInputsFrom(source)
    if (files.length) body.files = files
  }

  return body
}
