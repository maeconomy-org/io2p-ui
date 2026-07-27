'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  FileText,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react'

import { Badge, Button, ViewToggle } from '@/components/ui'
import { useFileDownload, useSignedUrlPrefetch } from '@/hooks/api/files'
import { usePreference } from '@/hooks/ui/use-preference'
import { cn } from '@/lib'
import type { DraftFile } from '@/lib/entity-body'

import {
  fileDisplayName,
  isImageFile,
  isResolvableUpload,
} from './file-helpers'

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
  onAttach,
  onRemove,
}: {
  files: DraftFile[]
  editing: boolean
  onAttach?: () => void
  onRemove?: (localId: string) => void
}) {
  const t = useTranslations()
  const [view, setView] = usePreference('filesView')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {t('objects.files.filesCount', { count: files.length })}
        </h3>
        <div className="flex items-center gap-2">
          {files.length > 0 && (
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
              onClick={onAttach}
            >
              <Paperclip className="mr-2 h-3.5 w-3.5" />
              {t('objects.files.addFiles')}
            </Button>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('objects.files.noFiles')}
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f) => (
            <FileTile
              key={f._localId}
              file={f}
              editing={editing}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <FileCard
              key={f._localId}
              file={f}
              editing={editing}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Shared per-file plumbing: what it is, whether its bytes are reachable, and how to fetch them. */
function useFileActions(file: DraftFile) {
  const download = useFileDownload()
  const downloadable = isResolvableUpload(file)
  const prefetch = useSignedUrlPrefetch(file.id, 'download', {
    enabled: downloadable,
  })
  return {
    download,
    downloadable,
    prefetch: downloadable ? prefetch : {},
    isRef: file.kind === 'reference',
    open: () => download.mutate({ id: file.id!, fileName: file.fileName }),
  }
}

function RemoveButton({
  onRemove,
  localId,
  label,
  className,
}: {
  onRemove: (localId: string) => void
  localId: string
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onRemove(localId)}
      className={cn(
        'shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive',
        className
      )}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

function FileCard({
  file,
  editing,
  onRemove,
}: {
  file: DraftFile
  editing: boolean
  onRemove?: (localId: string) => void
}) {
  const t = useTranslations()
  const [thumbBroken, setThumbBroken] = useState(false)
  const { download, downloadable, prefetch, isRef, open } = useFileActions(file)
  const name = fileDisplayName(file)
  const thumb =
    isImageFile(file) && !thumbBroken ? file.thumbnailUrl : undefined

  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm"
      {...prefetch}
    >
      {download.isPending ? (
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

      <div className="min-w-0 flex-1">
        {isRef && file.reference?.url ? (
          <a
            href={file.reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate hover:underline"
          >
            {name}
          </a>
        ) : downloadable ? (
          <button
            type="button"
            disabled={download.isPending}
            aria-busy={download.isPending}
            aria-label={`${t('common.download')} ${name}`}
            onClick={open}
            className="block w-full truncate text-left hover:underline disabled:cursor-progress"
          >
            {name}
          </button>
        ) : (
          <span
            className="block truncate text-muted-foreground"
            title={file.id ? t('objects.files.unavailable') : undefined}
          >
            {name}
          </span>
        )}
      </div>

      {isRef && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {t('objects.files.external')}
        </Badge>
      )}
      {downloadable && (
        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {editing && onRemove && (
        <RemoveButton
          onRemove={onRemove}
          localId={file._localId}
          label={t('common.remove')}
        />
      )}
    </div>
  )
}

function FileTile({
  file,
  editing,
  onRemove,
}: {
  file: DraftFile
  editing: boolean
  onRemove?: (localId: string) => void
}) {
  const t = useTranslations()
  const [thumbBroken, setThumbBroken] = useState(false)
  const { download, downloadable, prefetch, isRef, open } = useFileActions(file)
  const name = fileDisplayName(file)
  // Thumbnails are worker-derived after the upload completes, so a just-added image has none yet —
  // the icon placeholder is the normal state for a moment, not an error.
  const thumb =
    isImageFile(file) && !thumbBroken ? file.thumbnailUrl : undefined

  const body = (
    <>
      <div className="flex h-20 items-center justify-center overflow-hidden rounded-sm bg-muted">
        {download.isPending ? (
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
      <span className="mt-1 block truncate text-xs" title={name}>
        {name}
      </span>
    </>
  )

  return (
    <div className="group relative rounded-md border p-1.5" {...prefetch}>
      {isRef && file.reference?.url ? (
        <a
          href={file.reference.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {body}
        </a>
      ) : downloadable ? (
        <button
          type="button"
          disabled={download.isPending}
          aria-busy={download.isPending}
          aria-label={`${t('common.download')} ${name}`}
          onClick={open}
          className="block w-full text-left"
        >
          {body}
        </button>
      ) : (
        <div
          className="text-muted-foreground"
          title={file.id ? t('objects.files.unavailable') : undefined}
        >
          {body}
        </div>
      )}

      {editing && onRemove && (
        <RemoveButton
          onRemove={onRemove}
          localId={file._localId}
          label={t('common.remove')}
          className="absolute right-1 top-1 rounded-full bg-background/90 opacity-0 focus:opacity-100 group-hover:opacity-100"
        />
      )}
    </div>
  )
}
