'use client'

import { useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import type { EntityDraft } from '@/lib/entity'

import { AttachmentModal, ObjectFilesSection } from '../files'
import { useFileBag } from './use-file-bag'

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
  showTitle,
  basePath = 'files',
  allowCover = false,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
  entityId?: string
  allowViewToggle?: boolean
  showEmptyState?: boolean
  showTitle?: boolean
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
  const { files, add, remove, patch } = useFileBag(form, basePath)
  const coverFileId = useWatch({ control: form.control, name: 'coverFileId' })

  return (
    <>
      <ObjectFilesSection
        files={files}
        editing={editing}
        entityId={entityId}
        allowViewToggle={allowViewToggle}
        showEmptyState={showEmptyState}
        showTitle={showTitle}
        onAttach={editing ? () => setModalOpen(true) : undefined}
        onRemove={remove}
        onChange={patch}
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
        onAdd={add}
      />
    </>
  )
}
