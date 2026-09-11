'use client'

import {
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui'
import {
  ImageViewer,
  UnsupportedFallback,
} from '@/components/entity-sheet/file-viewers'
import {
  detectMimeType,
  detectPreviewKind,
  type PreviewKind,
} from './mime-type'
import { cn, formatBytes } from '@/lib/utils'
import { signedFileUrlQuery, useFileDownload } from '@/hooks/api/files'
import { useIomClient } from '@/lib/io2p'
import type { DraftFile } from '@/lib/entity'

import { fileDisplayName, isPreviewable } from './file-helpers'

const MediaViewer = dynamic(
  () =>
    import('@/components/entity-sheet/file-viewers/media-viewer').then(
      (m) => m.MediaViewer
    ),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)
const PdfViewer = dynamic(
  () =>
    import('@/components/entity-sheet/file-viewers/pdf-viewer').then(
      (m) => m.PdfViewer
    ),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)
const TextViewer = dynamic(
  () =>
    import('@/components/entity-sheet/file-viewers/text-viewer').then(
      (m) => m.TextViewer
    ),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)

const MIN_SCALE = 0.2
const MAX_SCALE = 8

// Inline preview cap for byte-buffered renderers. Video/audio stream via Range requests, so they're
// exempt.
const INLINE_PREVIEW_MAX_BYTES = 100 * 1024 * 1024
const SIZE_GUARDED_KINDS: ReadonlySet<PreviewKind> = new Set([
  'image',
  'pdf',
  'text',
])

/**
 * Full-screen preview for stored files, with sibling navigation. The url is minted on demand and
 * handed to a viewer as a plain `src`, so video/audio stream by Range request instead of being
 * buffered into memory.
 */
export function FilePreview({
  file,
  siblings = [],
  open,
  onOpenChange,
}: {
  file: DraftFile | null
  siblings?: DraftFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const client = useIomClient()
  const download = useFileDownload()

  const viewable = useMemo(() => {
    const pool = siblings.length > 0 ? siblings : file ? [file] : []
    return pool.filter(isPreviewable)
  }, [siblings, file])

  /**
   * The dialog opens on one file but can walk to its siblings, so `nav` records where the user went
   * — stamped with the (open, file) it started from.
   *
   * Derived rather than reset by an effect, and keyed off the id rather than the object: a parent
   * re-render hands us a new `file` reference for the SAME attachment, which would otherwise snap
   * the dialog back after a Next/Prev.
   */
  const session = `${open}:${file?._localId ?? ''}`
  const [nav, setNav] = useState<{ session: string; id: string } | null>(null)
  const currentId = nav?.session === session ? nav.id : (file?._localId ?? null)

  const currentIndex = viewable.findIndex((f) => f._localId === currentId)
  const current =
    currentIndex >= 0 ? viewable[currentIndex] : (file ?? viewable[0] ?? null)

  // Zoom and rotation belong to the file being LOOKED AT, so stamping them with its id is what
  // resets them on navigation — no effect, and no frame showing the previous file's zoom.
  const [view, setView] = useState({ id: currentId, scale: 1, rotation: 0 })
  const active =
    view.id === currentId ? view : { id: currentId, scale: 1, rotation: 0 }
  const { scale, rotation } = active
  const adjustView = (patch: Partial<{ scale: number; rotation: number }>) =>
    setView({ ...active, ...patch, id: currentId })

  const mime = current ? detectMimeType(current) : 'application/octet-stream'
  const kind: PreviewKind = detectPreviewKind(mime)

  const {
    data: signed,
    isLoading,
    error,
  } = useQuery({
    ...signedFileUrlQuery(client, current?.id ?? '', 'preview'),
    enabled: open && !!current?.id && kind !== 'unsupported',
  })
  const url = signed?.url

  const hasMultiple = viewable.length > 1

  const goTo = (delta: number) => {
    if (viewable.length <= 1 || currentIndex < 0) return
    const next = (currentIndex + delta + viewable.length) % viewable.length
    setNav({ session, id: viewable[next]._localId })
  }

  const zoom = (factor: number) =>
    adjustView({
      scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor)),
    })

  const resetView = () => adjustView({ scale: 1, rotation: 0 })
  const toggleZoom = () => adjustView({ scale: scale === 1 ? 2 : 1 })
  const rotate = () => adjustView({ rotation: (rotation + 90) % 360 })

  // Scoped to the dialog: a window-level listener would hijack +/-/r/0 from inputs elsewhere on the
  // page while the dialog is open.
  const handleDialogKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' && hasMultiple) {
      e.preventDefault()
      goTo(1)
    } else if (e.key === 'ArrowLeft' && hasMultiple) {
      e.preventDefault()
      goTo(-1)
    } else if (kind === 'image') {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoom(1.2)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoom(1 / 1.2)
      } else if (e.key === '0') {
        e.preventDefault()
        resetView()
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        rotate()
      }
    }
  }

  if (!current) return null

  const displayName = fileDisplayName(current)
  const showImageControls = kind === 'image' && !!url
  const doDownload = () =>
    download.mutate({ id: current.id!, fileName: current.fileName })

  const isOverSizeCap =
    SIZE_GUARDED_KINDS.has(kind) &&
    typeof current.size === 'number' &&
    current.size > INLINE_PREVIEW_MAX_BYTES

  const body = (() => {
    if (isOverSizeCap) {
      return (
        <TooLargeFallback
          fileName={displayName}
          size={current.size}
          mimeType={current.contentType ?? mime}
          onDownload={doDownload}
        />
      )
    }
    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6 text-sm text-destructive">
          {t('attachments.preview.loadFailed')}
        </div>
      )
    }
    switch (kind) {
      case 'image':
        return (
          <ImageViewer
            src={url ?? ''}
            alt={displayName}
            scale={url ? scale : 1}
            rotation={url ? rotation : 0}
            isLoading={isLoading || !url}
            onZoom={zoom}
            onToggleZoom={toggleZoom}
          />
        )
      case 'pdf':
        return url ? (
          <PdfViewer src={url} title={displayName} />
        ) : (
          <LoadingPlaceholder />
        )
      case 'text':
        return url ? <TextViewer src={url} /> : <LoadingPlaceholder />
      case 'video':
      case 'audio':
        return url ? (
          <MediaViewer
            kind={kind}
            src={url}
            mimeType={mime}
            alt={displayName}
          />
        ) : (
          <LoadingPlaceholder />
        )
      default:
        return (
          <UnsupportedFallback
            fileName={displayName}
            size={current.size}
            mimeType={current.contentType ?? mime}
          />
        )
    }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        noContainer
        className="flex h-[92vh] max-h-[92vh] w-[92vw] max-w-[92vw] flex-col gap-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-0 text-white shadow-2xl sm:rounded-xl"
        data-testid="file-preview-dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <VisuallyHidden>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            {t('attachments.preview.dialogDescription')}
          </DialogDescription>
        </VisuallyHidden>

        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-4 py-2 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-white"
              title={displayName}
            >
              {displayName}
            </p>
            {hasMultiple && currentIndex >= 0 && (
              <p className="text-xs text-white/50">
                {t('attachments.preview.counter', {
                  current: currentIndex + 1,
                  total: viewable.length,
                })}
              </p>
            )}
          </div>

          {showImageControls && (
            <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
                onClick={() => zoom(1 / 1.2)}
                aria-label={t('attachments.preview.zoomOut')}
                disabled={scale <= MIN_SCALE + 0.001}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span
                className="min-w-[3rem] text-center text-xs tabular-nums text-white/80"
                aria-live="polite"
              >
                {Math.round(scale * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
                onClick={() => zoom(1.2)}
                aria-label={t('attachments.preview.zoomIn')}
                disabled={scale >= MAX_SCALE - 0.001}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
                onClick={rotate}
                aria-label={t('attachments.preview.rotate')}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
                onClick={resetView}
                aria-label={t('attachments.preview.reset')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
            onClick={doDownload}
            disabled={download.isPending}
            data-testid="file-preview-download"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.download')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {body}

          {hasMultiple && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2',
                  'rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white'
                )}
                onClick={() => goTo(-1)}
                aria-label={t('attachments.preview.previous')}
                data-testid="file-preview-prev"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2',
                  'rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white'
                )}
                onClick={() => goTo(1)}
                aria-label={t('attachments.preview.next')}
                data-testid="file-preview-next"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TooLargeFallback({
  fileName,
  size,
  mimeType,
  onDownload,
}: {
  fileName: string
  size?: number
  mimeType?: string
  onDownload: () => void
}) {
  const t = useTranslations()
  const readable = formatBytes(size)
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      data-testid="file-preview-too-large"
    >
      <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-8 text-center text-white/90">
        <Download className="h-12 w-12 text-white/70" />
        <h3 className="text-base font-semibold">
          {t('attachments.preview.tooLargeForPreview')}
        </h3>
        <p className="break-all text-sm text-white/70">{fileName}</p>
        {(readable || mimeType) && (
          <p className="text-xs text-white/50">
            {[mimeType, readable].filter(Boolean).join(' · ')}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 gap-2 border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
          {t('common.download')}
        </Button>
      </div>
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>
  )
}
