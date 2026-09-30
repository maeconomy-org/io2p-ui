'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Paperclip, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DraftFile } from '@/lib/entity'

import { fileDisplayName, isPreviewable } from './file-helpers'
import { FilePreview } from './file-preview'
import { FileRow } from './file-row'

/**
 * The read-mode files toggle: a paperclip, the count and a chevron — the same shape as a formula's
 * Σ toggle, so every "more about this" on a row opens the same way.
 */
export function FilesToggle({
  count,
  open,
  onToggle,
  controls,
  label,
  className,
}: {
  count: number
  open: boolean
  onToggle: () => void
  controls: string
  /** What the files belong to, for a screen reader: "Files on this value". */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${label} (${count})`}
      data-testid="files-toggle"
      className={cn(
        'flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
    >
      <Paperclip className="h-3.5 w-3.5" />
      <span className="tabular-nums">{count}</span>
      <ChevronDown
        className={cn(
          'h-3 w-3 transition-transform motion-reduce:transition-none',
          open && 'rotate-180'
        )}
      />
    </button>
  )
}

/**
 * The opened list: one row per file, by name, each with its own actions. A long name truncates and
 * keeps the whole name on hover, so any number of files stays one column of rows. In edit mode it
 * ends with "Attach file or link", because the paperclip that opened it now lists instead of adds.
 */
export function FileList({
  id,
  files,
  entityId,
  editing = false,
  onRemove,
  onChange,
  onAttach,
}: {
  id: string
  files: DraftFile[]
  entityId?: string
  editing?: boolean
  onRemove?: (localId: string) => void
  onChange?: (
    localId: string,
    patch: Partial<DraftFile>,
    options?: { dirty?: boolean }
  ) => void
  onAttach?: () => void
}) {
  const t = useTranslations()
  const [previewFile, setPreviewFile] = useState<DraftFile | null>(null)
  // By name: they arrive in the order their uploads finished, which means nothing to a reader.
  const sorted = useMemo(
    () =>
      [...files].sort((a, b) =>
        fileDisplayName(a).localeCompare(fileDisplayName(b), undefined, {
          numeric: true,
        })
      ),
    [files]
  )
  return (
    <div id={id} className="space-y-1" data-testid="file-list">
      {sorted.map((f) => (
        <FileRow
          key={f._localId}
          file={f}
          editing={editing}
          entityId={entityId}
          onRemove={onRemove}
          onChange={onChange}
          onPreview={setPreviewFile}
        />
      ))}
      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          data-testid="files-attach-more"
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('objects.files.attachMore')}
        </button>
      )}
      <FilePreview
        file={previewFile}
        siblings={sorted.filter(isPreviewable)}
        open={previewFile !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewFile(null)
        }}
      />
    </div>
  )
}
