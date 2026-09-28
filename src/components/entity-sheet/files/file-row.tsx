'use client'

import { useTranslations } from 'next-intl'
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { isImageFile } from './file-helpers'
import { FileActions, primaryAction } from './file-actions'
import { useFileState } from './use-file-state'

/**
 * A single file under a property or value: a type icon, the name, one action (download, or open a
 * link) and remove. Clicking the row previews or downloads; the name is the same action as a real
 * button, so the keyboard reaches it too. A soft-deleted file is struck through and offers only
 * Restore — its bytes survive, but nothing can open them while it's deleted.
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
  const state = useFileState(file, { entityId, onChange })

  const isRef = file.kind === 'reference'
  const open = primaryAction(state, onPreview)
  const Icon = isRef ? LinkIcon : isImageFile(file) ? ImageIcon : FileText

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
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      {open ? (
        <button
          type="button"
          data-testid="file-open"
          className="min-w-0 flex-1 truncate text-left hover:underline hover:underline-offset-2"
          title={state.name}
          onClick={(e) => {
            e.stopPropagation()
            open()
          }}
        >
          {state.name}
        </button>
      ) : (
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            state.deleted && 'text-destructive line-through'
          )}
          title={state.name}
        >
          {state.name}
        </span>
      )}

      {state.deleted && (
        <Badge
          variant="outline"
          className="shrink-0 border-destructive text-[10px] text-destructive"
        >
          {t('common.deleted')}
        </Badge>
      )}

      <FileActions
        file={file}
        state={state}
        editing={editing}
        onPreview={onPreview}
        onDownload={state.download}
        onRemove={onRemove}
        showPreview={false}
      />
    </div>
  )
}
