'use client'

import { useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import type { DraftFile, EntityDraft } from '@/lib/entity'

import { AttachmentModal, ObjectFilesSection } from '../files'

/**
 * Object-level files bound to the form. Picks accumulate in the draft and upload after Save (io2p
 * needs an existing target), so this is the same deferred flow as property/value files — only the
 * attach level differs.
 */
/** Every place a file bag can live on the draft — spelled out so the paths stay type-checked. */
export type FilesPath =
  | 'files'
  | `inputs.${number}.files`
  | `outputs.${number}.files`

export function ObjectFilesField({
  form,
  editing,
  entityId,
  allowViewToggle,
  showEmptyState,
  basePath = 'files',
  allowCover = false,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  entityId?: string
  allowViewToggle?: boolean
  showEmptyState?: boolean
  /**
   * Offer "set as cover" on these rows. Entity-level only — the server accepts a file at any level,
   * but a picker that spanned every property and value would be a worse question to ask.
   */
  allowCover?: boolean
  /**
   * Which file bag this edits. Defaults to the entity's own; a process FLOW passes its own path, so
   * the same section serves both instead of a near-copy per container.
   */
  basePath?: FilesPath
}) {
  const [modalOpen, setModalOpen] = useState(false)
  // `useWatch`, NOT `form.watch` — this component does not own the `useForm`, it receives it, so
  // `watch` reads once and never re-subscribes. Under the production-only React Compiler that froze
  // the list: adding a file marked the sheet dirty and rendered nothing, and a second add dropped
  // the first from the stale closure below.
  const files = useWatch({ control: form.control, name: basePath }) ?? []
  const coverFileId = useWatch({ control: form.control, name: 'coverFileId' })

  const addFiles = (added: DraftFile[]) => {
    form.setValue(basePath, [...files, ...added], { shouldDirty: true })
  }

  const removeFile = (localId: string) => {
    form.setValue(
      basePath,
      files.filter((f) => f._localId !== localId),
      { shouldDirty: true }
    )
  }

  // Soft delete / restore already hit the server, so the draft is only catching up — marking it
  // dirty would offer to "save" a change that is already committed.
  const patchFile = (
    localId: string,
    patch: Partial<DraftFile>,
    options?: { dirty?: boolean }
  ) => {
    form.setValue(
      basePath,
      files.map((f) => (f._localId === localId ? { ...f, ...patch } : f)),
      { shouldDirty: options?.dirty ?? false }
    )
  }

  return (
    <>
      <ObjectFilesSection
        files={files}
        editing={editing}
        entityId={entityId}
        allowViewToggle={allowViewToggle}
        showEmptyState={showEmptyState}
        onAttach={editing ? () => setModalOpen(true) : undefined}
        onRemove={removeFile}
        onChange={patchFile}
        // Staged on the form like any other field, so Save writes it with the rest and Cancel
        // reverts it. Writing it here instead would bump `currentVersion` mid-edit and the sheet's
        // reload would discard whatever else was typed.
        onSetCover={
          allowCover
            ? (fileId) =>
                form.setValue('coverFileId', fileId, { shouldDirty: true })
            : undefined
        }
        coverFileId={coverFileId}
      />
      <AttachmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={addFiles}
      />
    </>
  )
}
