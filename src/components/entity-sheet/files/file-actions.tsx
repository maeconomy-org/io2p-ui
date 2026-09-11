'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { isImageFile } from './file-helpers'
import type { FileState } from './use-file-state'

/**
 * Whether this file could be the entity's cover.
 *
 * Mirrors the server's rules so the button never offers something that would 422: an UPLOADED,
 * READY, live IMAGE. A reference has no files-collection row and is rejected by construction; a
 * pending pick has no id yet; video is deferred with the video-thumbnail decision.
 *
 * The server accepts a file at ANY level (entity, property, value, flow) — narrowing the picker to
 * entity-level files is a UI choice, made by only passing `onSetCover` down that path.
 */
export function canBeCover(file: DraftFile, deleted: boolean): boolean {
  return (
    !deleted &&
    file.kind === 'upload' &&
    !!file.id &&
    file.status === 'ready' &&
    isImageFile(file)
  )
}

const ACTION =
  'shrink-0 rounded p-1 text-muted-foreground transition-colors disabled:opacity-50'

/**
 * The trailing action group for one file row: an explicit icon per action, so what a click will do
 * is visible before making it (an eye means it opens here, a download arrow means it saves).
 *
 * Which actions exist follows what the file IS — a reference opens externally and can only be
 * detached; stored bytes preview/download and are soft-deleted; a pending pick can only be discarded.
 */
export function FileActions({
  file,
  state,
  editing,
  onPreview,
  onDownload,
  onRemove,
  onSetCover,
  isCover,
  className,
}: {
  file: DraftFile
  state: FileState
  editing: boolean
  onPreview?: (file: DraftFile) => void
  onDownload: () => void
  onRemove?: (localId: string) => void
  /** Omitted everywhere but the entity's own file list — that is the picker's narrowing. */
  onSetCover?: (fileId: string | null) => void
  isCover?: boolean
  className?: string
}) {
  const t = useTranslations()
  const isRef = file.kind === 'reference'
  const canPreview = state.previewable && !!onPreview
  // EDIT MODE ONLY. `coverFileId` is an entity attribute, so it is staged and saved with the rest —
  // and read mode's footer has no Save, so a change made there could never be committed. The same
  // line the sheet already draws: a file's own soft-delete works in read mode because it commits
  // itself; anything that PATCHes the entity waits for Edit.
  const coverable =
    !!onSetCover && editing && canBeCover(state.file, state.deleted)

  return (
    // The row itself performs the primary action, so a click on an icon must not do it twice.
    <div
      className={cn('flex shrink-0 items-center gap-0.5', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {!state.deleted && isRef && file.reference?.url && (
        <a
          href={file.reference.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="file-open-external"
          aria-label={`${t('objects.files.openExternal')} ${state.name}`}
          title={t('objects.files.openExternal')}
          className={cn(ACTION, 'hover:text-foreground')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {canPreview && (
        <button
          type="button"
          data-testid="file-preview"
          aria-label={`${t('objects.files.preview')} ${state.name}`}
          title={t('objects.files.preview')}
          onClick={() => onPreview?.(state.file)}
          className={cn(ACTION, 'hover:text-foreground')}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}

      {state.downloadable && (
        <button
          type="button"
          data-testid="file-download"
          aria-label={`${t('common.download')} ${state.name}`}
          title={t('common.download')}
          onClick={onDownload}
          disabled={state.downloading}
          className={cn(ACTION, 'hover:text-foreground')}
        >
          {state.downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* Read mode still SHOWS which file is the cover — that is worth knowing without entering
          Edit — it just cannot be changed there. */}
      {isCover && !editing && (
        <span
          data-testid="file-cover-current"
          className={cn(ACTION, 'text-amber-500')}
          title={t('objects.cover.current')}
          aria-label={`${t('objects.cover.current')}: ${state.name}`}
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </span>
      )}

      {/* A filled star means "this is the cover" and clicking it clears; an outline offers the
          swap. One control for both directions, because they are the same decision. */}
      {editing && (coverable || isCover) && onSetCover && (
        <button
          type="button"
          aria-label={
            isCover
              ? `${t('objects.cover.clear')} ${state.name}`
              : `${t('objects.cover.set')} ${state.name}`
          }
          data-testid="file-cover-toggle"
          title={isCover ? t('objects.cover.clear') : t('objects.cover.set')}
          aria-pressed={!!isCover}
          onClick={() => onSetCover(isCover ? null : (state.file.id ?? null))}
          className={cn(
            ACTION,
            isCover
              ? 'text-amber-500 hover:text-amber-600'
              : 'hover:text-foreground'
          )}
        >
          {isCover ? (
            <Star className="h-3.5 w-3.5 fill-current" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <RemoveAction
        state={state}
        localId={file._localId}
        editing={editing}
        onRemove={onRemove}
      />
    </div>
  )
}

/**
 * Nothing here destroys anything — the modes differ in WHEN the deletion applies. A stored file is
 * soft-deleted immediately on its own record, so it stays available outside edit mode. A reference
 * lives only in the entity body, so it is marked and applied by the next save; discarding an unsaved
 * pick is likewise a draft edit. Both of those wait for edit mode.
 */
function RemoveAction({
  state,
  localId,
  editing,
  onRemove,
}: {
  state: FileState
  localId: string
  editing: boolean
  onRemove?: (localId: string) => void
}) {
  const t = useTranslations()
  const [confirming, setConfirming] = useState(false)

  if (state.busy) {
    return <Loader2 className={cn(ACTION, 'h-5 w-5 animate-spin')} />
  }

  if (state.removalMode === 'restore') {
    return (
      <button
        type="button"
        data-testid="file-restore"
        aria-label={`${t('objects.files.restore')} ${state.name}`}
        title={t('objects.files.restore')}
        onClick={state.restore}
        className={cn(ACTION, 'hover:text-foreground')}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    )
  }

  if (
    state.removalMode === 'soft-delete' ||
    state.removalMode === 'mark-deleted'
  ) {
    // Two-step confirm, matching the property editor: the icon becomes the word "Confirm?" and only
    // the second click deletes. Blurring backs out, so a mis-click costs nothing.
    return confirming ? (
      <button
        type="button"
        data-testid="file-delete-confirm"
        onClick={() => {
          setConfirming(false)
          state.softDelete()
        }}
        onBlur={() => setConfirming(false)}
        autoFocus
        className={cn(ACTION, 'px-1 text-xs text-destructive')}
      >
        {t('common.confirm')}
      </button>
    ) : (
      <button
        type="button"
        data-testid="file-delete"
        aria-label={`${t('objects.files.delete')} ${state.name}`}
        title={t('objects.files.delete')}
        onClick={() => setConfirming(true)}
        className={cn(ACTION, 'hover:text-destructive')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )
  }

  // 'discard' — nothing was ever stored, so this just drops the row.
  if (!editing || !onRemove) return null

  return (
    <button
      type="button"
      data-testid="file-remove"
      aria-label={`${t('common.remove')} ${state.name}`}
      title={t('common.remove')}
      onClick={() => onRemove(localId)}
      className={cn(ACTION, 'hover:text-destructive')}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

/**
 * What clicking the row itself should do: open it where we can render it, otherwise save it. Returns
 * undefined when there's nothing to open, so the row stays inert rather than looking clickable.
 */
export function primaryAction(
  state: FileState,
  onPreview?: (file: DraftFile) => void
): (() => void) | undefined {
  if (state.previewable && onPreview) return () => onPreview(state.file)
  if (state.downloadable) return state.download
  return undefined
}
