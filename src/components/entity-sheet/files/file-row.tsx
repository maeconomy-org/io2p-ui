'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Link as LinkIcon, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { isImageFile } from './file-helpers'
import { FileActions, primaryAction } from './file-actions'
import { useFileState } from './use-file-state'

/**
 * A single file under a property or value. The name is plain text and every action is its own icon,
 * so what a click will do is legible before making it. A soft-deleted file is struck through and
 * offers only Restore — its bytes survive, but nothing can open them while it's deleted.
 */
export function FileRow({
  file,
  editing,
  entityId,
  onRemove,
  onChange,
  onPreview,
}: {
  file: DraftFile
  editing: boolean
  entityId?: string
  onRemove?: (localId: string) => void
  onChange?: (
    localId: string,
    patch: Partial<DraftFile>,
    options?: { dirty?: boolean }
  ) => void
  onPreview?: (file: DraftFile) => void
}) {
  const t = useTranslations()
  const [thumbBroken, setThumbBroken] = useState(false)
  const state = useFileState(file, { entityId, onChange })

  const isRef = file.kind === 'reference'
  // Clicking the row does the obvious thing; the icons stay as the explicit, keyboard-reachable
  // controls (a focusable row wrapping focusable buttons is not valid, so the row is mouse-only).
  const open = primaryAction(state, onPreview)
  const thumb =
    !state.deleted && isImageFile(file) && !thumbBroken
      ? file.thumbnailUrl
      : undefined

  return (
    <div
      data-testid="file-row"
      data-deleted={state.deleted}
      data-name={state.name}
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
        state.deleted ? 'border-destructive/20 bg-destructive/10' : 'bg-card',
        open && 'cursor-pointer hover:bg-accent/50'
      )}
      onClick={open}
      {...state.prefetch}
    >
      {state.resolving ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-6 w-6 shrink-0 rounded-sm object-cover"
          onError={() => setThumbBroken(true)}
        />
      ) : isRef ? (
        <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          state.deleted && 'text-destructive line-through'
        )}
        title={state.name}
      >
        {state.name}
      </span>

      {state.deleted ? (
        <Badge
          variant="outline"
          className="shrink-0 border-destructive text-[10px] text-destructive"
        >
          {t('common.deleted')}
        </Badge>
      ) : (
        isRef && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t('objects.files.external')}
          </Badge>
        )
      )}

      <FileActions
        file={file}
        state={state}
        editing={editing}
        onPreview={onPreview}
        onDownload={state.download}
        onRemove={onRemove}
      />
    </div>
  )
}
