'use client'

import { memo, useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'
import {
  Eye,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIcon,
  Link as LinkIcon,
  Music,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
} from '@/components/ui'
import { useFilesApi } from '@/hooks'
import type { FileData } from '@/types'
import { detectMimeType, detectPreviewKind, logger, truncateText } from '@/lib'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

import { isExternalFileReference } from '../utils'
import { useInViewport } from '../hooks/use-in-viewport'
import { useFileThumbnail } from '../hooks/use-file-thumbnail'
import {
  getDisplayName,
  handleFileOpen,
  isPreviewableFile,
} from './file-display'
import { FileThumbnail } from './file-thumbnail'

interface FileTileProps {
  file: FileData
  onPreview?: (file: FileData) => void
}

/** Large glyph for the thumbnail area when there's no image to show. */
function getLargeFileIcon(file: FileData): ReactElement {
  const size = 'h-10 w-10'
  if (isExternalFileReference(file.fileReference)) {
    return <LinkIcon className={cn(size, 'text-blue-600')} />
  }
  const kind = detectPreviewKind(detectMimeType(file))
  switch (kind) {
    case 'image':
      return <ImageIcon className={size} />
    case 'pdf':
    case 'text':
      return <FileText className={size} />
    case 'video':
      return <Film className={size} />
    case 'audio':
      return <Music className={size} />
    default:
      return <FileIcon className={size} />
  }
}

export const FileTile = memo(function FileTile({
  file,
  onPreview,
}: FileTileProps) {
  const t = useTranslations()
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const [ref, isVisible] = useInViewport<HTMLDivElement>()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isSoftDeleted = file.softDeleted
  const displayName = getDisplayName(file)
  const canPreview = isPreviewableFile(file)
  const largeIcon = getLargeFileIcon(file)

  const thumb = useFileThumbnail(file, isVisible && !isSoftDeleted)

  const { useSoftDeleteFile } = useFilesApi()
  const softDeleteFile = useSoftDeleteFile()

  // Prefetch the presigned preview URL on hover/focus so opening the preview
  // modal feels instant. Image tiles already populate this cache via their
  // thumbnail fetch; this mainly covers non-image previewables (e.g. PDF).
  const prefetchedRef = useRef<string | null>(null)
  const handlePrefetch = useCallback(() => {
    if (!canPreview || !file.fileReference) return
    if (isExternalFileReference(file.fileReference)) return
    if (prefetchedRef.current === file.fileReference) return
    prefetchedRef.current = file.fileReference
    queryClient.prefetchQuery({
      queryKey: queryKeys.files.previewUrl(file.fileReference),
      queryFn: ({ signal }) =>
        client.fileStorage.getPreviewUrl(file.fileReference, { signal }),
    })
  }, [canPreview, file.fileReference, queryClient, client])
  const handlePrefetchLeave = useCallback(() => {
    prefetchedRef.current = null
  }, [])

  const handleOpen = () => {
    if (canPreview && onPreview) {
      onPreview(file)
    } else {
      handleFileOpen(file, client, () =>
        toast.error(t('common.downloadFailed'))
      )
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  const handlePreviewClick = (e: MouseEvent) => {
    e.stopPropagation()
    onPreview?.(file)
  }

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!file.uuid) {
      logger.error('Cannot soft-delete file without uuid', { file })
      toast.error(t('common.deleteFailed'))
      setShowDeleteConfirm(false)
      return
    }
    softDeleteFile.mutate(file.uuid)
    setShowDeleteConfirm(false)
  }

  return (
    <>
      {/* content-visibility lets the browser skip rendering off-screen tiles in
          long grids; the `auto` intrinsic-size keyword remembers the real size
          after first paint, so scrollbar height stays stable. */}
      <div
        className="group relative [contain-intrinsic-size:auto_240px] [content-visibility:auto]"
        ref={ref}
      >
        <div
          role="button"
          tabIndex={isSoftDeleted ? -1 : 0}
          aria-label={displayName}
          data-testid={`file-tile-${file.uuid || file.fileReference || displayName}`}
          onClick={!isSoftDeleted ? handleOpen : undefined}
          onKeyDown={!isSoftDeleted ? handleKeyDown : undefined}
          onPointerEnter={!isSoftDeleted ? handlePrefetch : undefined}
          onPointerLeave={!isSoftDeleted ? handlePrefetchLeave : undefined}
          onFocus={!isSoftDeleted ? handlePrefetch : undefined}
          onBlur={!isSoftDeleted ? handlePrefetchLeave : undefined}
          className={cn(
            'block overflow-hidden rounded-md border outline-none transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring',
            isSoftDeleted
              ? 'border-destructive/20 bg-destructive/10 opacity-60'
              : 'cursor-pointer bg-card hover:bg-accent'
          )}
        >
          <div className="relative aspect-square w-full overflow-hidden border-b bg-muted">
            <FileThumbnail state={thumb} alt={displayName} icon={largeIcon} />
          </div>
          <div className="flex items-center gap-1.5 p-2">
            <span
              className={cn(
                'flex-1 truncate text-xs',
                isSoftDeleted && 'text-destructive line-through'
              )}
            >
              {truncateText(displayName, 40)}
            </span>
            {isSoftDeleted && (
              <Badge
                variant="outline"
                className="border-destructive text-[10px] text-destructive"
              >
                {t('common.deleted')}
              </Badge>
            )}
          </div>
        </div>

        {/* Hover/focus action overlay. The container ignores pointer events so
            it doesn't block card clicks; the buttons re-enable them. */}
        {!isSoftDeleted && (
          <div className="pointer-events-none absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {canPreview && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="pointer-events-auto h-6 w-6 p-0 shadow-sm"
                onClick={handlePreviewClick}
                title={t('objects.files.preview')}
                aria-label={t('objects.files.preview')}
                data-testid={`file-tile-preview-${file.uuid || displayName}`}
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="pointer-events-auto h-6 w-6 p-0 text-destructive shadow-sm hover:text-destructive/80"
              onClick={handleDeleteClick}
              title={t('objects.files.delete')}
              aria-label={t('objects.files.delete')}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('objects.files.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('objects.files.deleteConfirm', { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
