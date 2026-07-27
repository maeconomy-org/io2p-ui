'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  ExternalLink,
  Eye,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

import { cn } from '@/lib'
import type { DraftFile } from '@/lib/entity-body'

import type { FileState } from './use-file-state'

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
  className,
}: {
  file: DraftFile
  state: FileState
  editing: boolean
  onPreview?: (file: DraftFile) => void
  onDownload: () => void
  onRemove?: (localId: string) => void
  className?: string
}) {
  const t = useTranslations()
  const isRef = file.kind === 'reference'
  const canPreview = state.previewable && !!onPreview

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
