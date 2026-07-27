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
export function ObjectFilesField({
  form,
  editing,
  entityId,
  allowViewToggle,
  showEmptyState,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  entityId?: string
  allowViewToggle?: boolean
  showEmptyState?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const files = form.watch('files') ?? []

  const addFiles = (added: DraftFile[]) => {
    form.setValue('files', [...files, ...added], { shouldDirty: true })
  }

  const removeFile = (localId: string) => {
    form.setValue(
      'files',
      files.filter((f) => f._localId !== localId),
      { shouldDirty: true }
    )
  }

  // Soft delete / restore already hit the server, so the draft is only catching up — marking it
  // dirty would offer to "save" a change that is already committed.
  const patchFile = (localId: string, patch: Partial<DraftFile>) => {
    form.setValue(
      'files',
      files.map((f) => (f._localId === localId ? { ...f, ...patch } : f)),
      { shouldDirty: false }
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
