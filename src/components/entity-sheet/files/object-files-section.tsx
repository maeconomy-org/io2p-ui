'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileText,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Loader2,
  Paperclip,
} from 'lucide-react'

import { Badge, Button, ViewToggle } from '@/components/ui'
import { usePreference } from '@/hooks/ui/use-preference'
import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { isImageFile, isPreviewable } from './file-helpers'
import { FileActions, primaryAction } from './file-actions'
import { FilePreview } from './file-preview'
import { useFileState } from './use-file-state'

type FileChange = (
  localId: string,
  patch: Partial<DraftFile>,
  options?: { dirty?: boolean }
) => void

interface RowProps {
  file: DraftFile
  editing: boolean
  entityId?: string
  onRemove?: (localId: string) => void
  onChange?: FileChange
  onPreview?: (file: DraftFile) => void
  /** Present only at ENTITY level — that is how the picker is narrowed. */
  onSetCover?: (fileId: string | null) => void
  coverFileId?: string | null
}

/**
 * Object-level files, as a standalone section so the same component backs both the Files TAB (edit
 * / view) and the Files step of the create form — the two shells differ, the content doesn't.
 *
 * Shows ONLY files attached to the object itself; property- and value-level files stay under their
 * own property/value (they're scoped there and would be misleading hoisted up here).
 */
export function ObjectFilesSection({
  files,
  editing,
  entityId,
  onAttach,
  onRemove,
  onChange,
  onSetCover,
  coverFileId,
  allowViewToggle = true,
  showEmptyState = true,
}: {
  files: DraftFile[]
  editing: boolean
  entityId?: string
  onAttach?: () => void
  onRemove?: (localId: string) => void
  onChange?: FileChange
  /** Omitted by the create form and by property/value file lists. */
  onSetCover?: (fileId: string | null) => void
  coverFileId?: string | null
  /** Off while creating: nothing is uploaded yet, so there are no thumbnails for a grid to show. */
  allowViewToggle?: boolean
  /** Off while creating: an empty object is the expected state, not something to report. */
  showEmptyState?: boolean
}) {
  const t = useTranslations()
  const [storedView, setView] = usePreference('filesView')
  const view = allowViewToggle ? storedView : 'list'
  const [previewFile, setPreviewFile] = useState<DraftFile | null>(null)

  const rowProps = {
    editing,
    entityId,
    onRemove,
    onChange,
    onSetCover,
    coverFileId,
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t('objects.filesTitle')}</h3>
        <div className="flex items-center gap-2">
          {allowViewToggle && files.length > 0 && (
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'list',
                  icon: List,
                  label: t('objects.files.listView'),
                },
                {
                  value: 'grid',
                  icon: LayoutGrid,
                  label: t('objects.files.gridView'),
                },
              ]}
            />
          )}
          {editing && onAttach && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="add-files"
              onClick={onAttach}
            >
              <Paperclip className="mr-2 h-3.5 w-3.5" />
              {t('objects.files.addFiles')}
            </Button>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        showEmptyState ? (
          <p
            data-testid="files-empty"
            className="text-sm text-muted-foreground"
          >
            {t('objects.files.noFiles')}
          </p>
        ) : null
      ) : view === 'grid' ? (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f) => (
            <FileTile
              key={f._localId}
              file={f}
              {...rowProps}
              onPreview={setPreviewFile}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <FileCard
              key={f._localId}
              file={f}
              {...rowProps}
              onPreview={setPreviewFile}
            />
          ))}
        </div>
      )}

      <FilePreview
        file={previewFile}
        siblings={files.filter(isPreviewable)}
        open={previewFile !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewFile(null)
        }}
      />
    </div>
  )
}

function FileCard({
  file,
  editing,
  entityId,
  onRemove,
  onChange,
  onPreview,
  onSetCover,
  coverFileId,
}: RowProps) {
  const t = useTranslations()
  const [thumbBroken, setThumbBroken] = useState(false)
  const state = useFileState(file, { entityId, onChange })
  const isRef = file.kind === 'reference'
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
        'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
        state.deleted ? 'border-destructive/20 bg-destructive/10' : 'bg-card',
        open && 'cursor-pointer hover:bg-accent/50'
      )}
      onClick={open}
      {...state.prefetch}
    >
      {state.resolving ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
      ) : thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-8 w-8 shrink-0 rounded-sm object-cover"
          onError={() => setThumbBroken(true)}
        />
      ) : isRef ? (
        <LinkIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
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
        onSetCover={onSetCover}
        isCover={!!file.id && file.id === coverFileId}
      />
    </div>
  )
}

function FileTile({
  file,
  editing,
  entityId,
  onRemove,
  onChange,
  onPreview,
  onSetCover,
  coverFileId,
}: RowProps) {
  const [thumbBroken, setThumbBroken] = useState(false)
  const state = useFileState(file, { entityId, onChange })
  const isRef = file.kind === 'reference'
  const open = primaryAction(state, onPreview)
  // Thumbnails are worker-derived after the upload completes, so a just-added image has none yet —
  // the icon placeholder is the normal state for a moment, not an error.
  const thumb =
    !state.deleted && isImageFile(file) && !thumbBroken
      ? file.thumbnailUrl
      : undefined

  return (
    <div
      className={cn(
        'group relative rounded-md border p-1.5',
        state.deleted && 'border-destructive/20 bg-destructive/10',
        open && 'cursor-pointer hover:bg-accent/50'
      )}
      onClick={open}
      {...state.prefetch}
    >
      <div className="flex h-20 items-center justify-center overflow-hidden rounded-sm bg-muted">
        {state.resolving ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setThumbBroken(true)}
          />
        ) : isRef ? (
          <LinkIcon className="h-6 w-6 text-muted-foreground" />
        ) : (
          <FileText className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <span
        className={cn(
          'mt-1 block truncate text-xs',
          state.deleted && 'text-destructive line-through'
        )}
        title={state.name}
      >
        {state.name}
      </span>

      <FileActions
        file={file}
        state={state}
        editing={editing}
        onPreview={onPreview}
        onDownload={state.download}
        onRemove={onRemove}
        onSetCover={onSetCover}
        isCover={!!file.id && file.id === coverFileId}
        className="absolute right-1 top-1 rounded-md bg-background/90 opacity-0 shadow-sm focus-within:opacity-100 group-hover:opacity-100"
      />
    </div>
  )
}
