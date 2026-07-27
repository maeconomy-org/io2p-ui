'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui'
import { useFileDownload, useSignedUrlPrefetch } from '@/hooks/api/files'
import { cn } from '@/lib'
import type { DraftFile } from '@/lib/entity-body'

import {
  fileDisplayName,
  isImageFile,
  isResolvableUpload,
} from './file-helpers'

/**
 * A single file in a disclosure list. A reference links straight to its external url; an uploaded
 * file mints a presigned download url on click (the entity read carries no download url — only a
 * thumbnail). A pending pick, or a file that is soft-deleted / not yet ready, is inert text.
 */
export function FileRow({
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
  const download = useFileDownload()

  const name = fileDisplayName(file)
  const isRef = file.kind === 'reference'
  const downloadable = isResolvableUpload(file)
  // Warm the presigned url on hover/focus so the click doesn't wait on a round trip.
  const prefetch = useSignedUrlPrefetch(file.id, 'download', {
    enabled: downloadable,
  })

  // The inlined thumbnail is itself a short-lived presigned url, and the entity query doesn't
  // refetch on focus — so a long-open sheet can end up with expired image urls. Fall back to the icon.
  const thumb =
    isImageFile(file) && !thumbBroken ? file.thumbnailUrl : undefined

  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm"
      {...(downloadable ? prefetch : {})}
    >
      {download.isPending ? (
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

      {isRef && file.reference?.url ? (
        <a
          href={file.reference.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-1 truncate hover:underline"
        >
          <span className="truncate">{name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </a>
      ) : downloadable ? (
        <button
          type="button"
          disabled={download.isPending}
          aria-busy={download.isPending}
          aria-label={`${t('common.download')} ${name}`}
          onClick={() =>
            download.mutate({ id: file.id!, fileName: file.fileName })
          }
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left hover:underline disabled:cursor-progress disabled:opacity-70"
        >
          <span className="truncate">{name}</span>
          <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-muted-foreground"
          title={file.id ? t('objects.files.unavailable') : undefined}
        >
          {name}
        </span>
      )}

      {isRef && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {t('objects.files.external')}
        </Badge>
      )}

      {editing && onRemove && (
        <button
          type="button"
          aria-label={t('common.remove')}
          className={cn(
            'shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive'
          )}
          onClick={() => onRemove(file._localId)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
