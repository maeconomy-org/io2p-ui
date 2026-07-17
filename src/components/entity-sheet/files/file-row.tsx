'use client'

import { useTranslations } from 'next-intl'
import { ExternalLink, FileText, Link as LinkIcon, X } from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib'
import type { DraftFile } from '@/lib/entity-body'

import { fileDisplayName, isImageFile } from './file-helpers'

// A single file in a disclosure list. Uploads link to their presigned downloadUrl (opens in a new
// tab); references link straight to their external url. A pending pick (no id/url yet) is inert text.
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
  const name = fileDisplayName(file)
  const isRef = file.kind === 'reference'
  const href = isRef ? file.reference?.url : file.downloadUrl
  const thumb = isImageFile(file) ? file.thumbnailUrl : undefined

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm">
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="h-6 w-6 shrink-0 rounded-sm object-cover"
        />
      ) : isRef ? (
        <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-1 truncate hover:underline"
        >
          <span className="truncate">{name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
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
