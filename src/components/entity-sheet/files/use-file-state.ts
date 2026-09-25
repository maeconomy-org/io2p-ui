'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fileRecordQuery,
  useFileDelete,
  useFileDownload,
  useFileRestore,
  useSignedUrlPrefetch,
} from '@/hooks/api/files'
import { useIomClient } from '@/lib/io2p'
import type { DraftFile } from '@/lib/entity'

import {
  fileDisplayName,
  isPreviewable,
  isResolvableUpload,
} from './file-helpers'

/** How a file row may be removed. Nothing is ever destroyed — the difference is WHEN it applies. */
export type RemovalMode =
  /** Never uploaded: dropping it from the draft loses nothing, because nothing was stored. */
  | 'discard'
  /** A stored file: soft-deleted immediately via the files collection, restorable at once. */
  | 'soft-delete'
  /** A reference: marked in the draft and soft-deleted by the body on Save, like any other edit. */
  | 'mark-deleted'
  /** Already deleted — the only action left is undo. */
  | 'restore'

export interface FileState {
  /** The draft file merged with its resolved record — use this for anything downstream. */
  file: DraftFile
  name: string
  deleted: boolean
  /** Resolving a bare ref to find out whether it's deleted, pending or gone. */
  resolving: boolean
  downloadable: boolean
  previewable: boolean
  downloading: boolean
  removalMode: RemovalMode
  busy: boolean
  download: () => void
  softDelete: () => void
  restore: () => void
  /** Spread onto the row so hovering warms the url the actions will need. */
  prefetch: Record<string, () => void>
}

/**
 * The single source of per-file behaviour, shared by every level (object / property / value) so the
 * three render paths can't drift.
 *
 * A soft-deleted file comes back from the entity read as a BARE `{id, kind}` ref — enrichment skips
 * anything not live — so the name and the reason are resolved from the files record instead. A
 * deleted file exposes no way to open it: preview and download 404 by design, and the only action is
 * Restore.
 */
export function useFileState(
  file: DraftFile,
  options: {
    entityId?: string
    /**
     * Write the outcome back into the draft. `dirty` marks the form changed — true for a reference,
     * whose delete/restore is only applied by the next save; false for a stored file, already done.
     */
    onChange?: (
      localId: string,
      patch: Partial<DraftFile>,
      options?: { dirty?: boolean }
    ) => void
  } = {}
): FileState {
  const { entityId, onChange } = options
  const client = useIomClient()
  const del = useFileDelete()
  const restoreMutation = useFileRestore()
  const downloadMutation = useFileDownload()

  // What THIS session did, independent of whether a parent wired `onChange` — without it a row in a
  // read-only view would keep rendering a file it just deleted.
  const [sessionDeleted, setSessionDeleted] = useState<boolean | undefined>()

  const isStored = file.kind === 'upload' && !!file.id
  // Enrichment fills fileName for a live file, so a stored file without one is not live.
  const isBare = isStored && !file.fileName
  const { data: record, isLoading: resolving } = useQuery({
    ...fileRecordQuery(client, file.id ?? ''),
    enabled: isBare,
  })

  // A delete/restore in this session wins; otherwise trust the draft, then the record.
  const deleted = sessionDeleted ?? file.deleted ?? record?.deleted ?? false

  /**
   * The draft holds only what enrichment gave us, and enrichment skips non-live files — so a file
   * that was already deleted when the entity loaded arrives with nothing but an id. Merging the
   * record back in is what lets it become openable again the moment it's restored; without this it
   * would stay nameless and actionless until a full reload.
   */
  const effective: DraftFile = {
    ...file,
    fileName: file.fileName ?? record?.fileName,
    contentType: file.contentType ?? record?.contentType,
    type: file.type ?? record?.type,
    size: file.size ?? record?.size,
    status: file.status ?? record?.status,
    deleted,
  }
  const name = fileDisplayName(effective)

  const removalMode: RemovalMode = deleted
    ? 'restore'
    : file.kind === 'reference'
      ? file.id
        ? 'mark-deleted' // saved reference: the body soft-deletes it, and can restore it
        : 'discard' // never saved, so there is nothing to preserve
      : isStored
        ? 'soft-delete'
        : 'discard'

  const downloadable = isResolvableUpload(effective)
  const previewable = isPreviewable(effective)
  // Warm whichever url the row's primary action needs, so the click doesn't wait on a round trip.
  const prefetch = useSignedUrlPrefetch(
    file.id,
    previewable ? 'preview' : 'download',
    { enabled: downloadable }
  )

  return {
    file: effective,
    name,
    deleted,
    resolving,
    downloadable,
    previewable,
    downloading: downloadMutation.isPending,
    prefetch: downloadable ? prefetch : {},
    download: () =>
      downloadMutation.mutate({ id: file.id!, fileName: effective.fileName }),
    removalMode,
    busy: del.isPending || restoreMutation.isPending,
    // A reference lives only in the entity body, so its lifecycle follows the body's save cycle —
    // exactly like adding one. A stored file has its own record, so it deletes immediately.
    softDelete: () => {
      if (file.kind === 'reference') {
        setSessionDeleted(true)
        return onChange?.(file._localId, { deleted: true }, { dirty: true })
      }
      del.mutate(
        { id: file.id!, entityId },
        {
          onSuccess: () => {
            setSessionDeleted(true)
            onChange?.(file._localId, { deleted: true })
          },
        }
      )
    },
    restore: () => {
      if (file.kind === 'reference') {
        setSessionDeleted(false)
        return onChange?.(file._localId, { deleted: false }, { dirty: true })
      }
      restoreMutation.mutate(
        { id: file.id!, entityId },
        {
          onSuccess: () => {
            setSessionDeleted(false)
            onChange?.(file._localId, { deleted: false })
          },
        }
      )
    },
  }
}
