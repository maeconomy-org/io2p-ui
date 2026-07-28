'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DraftFile, EntityDraft } from '@/lib/entity-body'

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
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  entityId?: string
  allowViewToggle?: boolean
  showEmptyState?: boolean
  /**
   * Which file bag this edits. Defaults to the entity's own; a process FLOW passes its own path, so
   * the same section serves both instead of a near-copy per container.
   */
  basePath?: FilesPath
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const files = form.watch(basePath) ?? []

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
      />
      <AttachmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={addFiles}
      />
    </>
  )
}
