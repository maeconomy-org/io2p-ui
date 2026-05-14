'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import dynamic from 'next/dynamic'
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
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui'
import {
  detectMimeType,
  detectPreviewKind,
  logger,
  type PreviewKind,
} from '@/lib'
import { useIomSdkClient } from '@/contexts'
import type { FileData } from '@/types'

import { downloadFileToClient } from './download-file'
import { ImageViewer } from './image-viewer'
import { UnsupportedFallback } from './unsupported-fallback'
import { useFilePreviewUrl } from './use-file-preview-url'
import { isExternalFileReference } from '@/components/object-sheets/utils'

const MediaViewer = dynamic(
  () => import('./media-viewer').then((m) => m.MediaViewer),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)
const PdfViewer = dynamic(
  () => import('./pdf-viewer').then((m) => m.PdfViewer),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)
const TextViewer = dynamic(
  () => import('./text-viewer').then((m) => m.TextViewer),
  { ssr: false, loading: () => <LoadingPlaceholder /> }
)

interface AttachmentPreviewProps {
  file: FileData | null
  siblings?: FileData[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MIN_SCALE = 0.2
const MAX_SCALE = 8

function getDisplayName(file: FileData): string {
  return file.fileName || file.label || 'file'
}

function isSupportedKind(kind: PreviewKind): boolean {
  return kind !== 'unsupported'
}

export function AttachmentPreview({
  file,
  siblings = [],
  open,
  onOpenChange,
}: AttachmentPreviewProps) {
  const t = useTranslations()
  const client = useIomSdkClient()

  const viewable = useMemo(() => {
    const pool = siblings.length > 0 ? siblings : file ? [file] : []
    return pool.filter((f) => {
      if (f.softDeleted) return false
      const mime = detectMimeType(f)
      const kind = detectPreviewKind(mime)
      return isSupportedKind(kind)
    })
  }, [siblings, file])

  const [currentUuid, setCurrentUuid] = useState<string | null>(
    file?.uuid ?? null
  )
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Depend on `file?.uuid` (primitive) rather than `file` (object identity).
  // Parent re-renders frequently hand us a new `file` reference for the same
  // attachment; without this we'd snap back to the originally-clicked file
  // whenever the parent rerendered after a Next/Prev navigation.
  useEffect(() => {
    if (open) setCurrentUuid(file?.uuid ?? null)
  }, [open, file?.uuid])

  const currentIndex = viewable.findIndex((f) => f.uuid === currentUuid)
  const current =
    currentIndex >= 0 ? viewable[currentIndex] : (file ?? viewable[0] ?? null)

  const mime = current ? detectMimeType(current) : 'application/octet-stream'
  const kind: PreviewKind = detectPreviewKind(mime)
  const isExternal = current
    ? isExternalFileReference(current.fileReference)
    : false

  // The hook returns the presigned URL (or external-ref URL) directly — viewers
  // consume it as a plain `src`, so video can stream + range-fetch instead of
  // buffering the whole file into memory via createObjectURL.
  const { url, isLoading, error } = useFilePreviewUrl(
    current,
    open && isSupportedKind(kind)
  )

  // Reset zoom/rotation when the current file changes.
  useEffect(() => {
    setScale(1)
    setRotation(0)
  }, [currentUuid])

  const hasMultiple = viewable.length > 1

  // Keep latest nav state in a ref so `goTo` stays referentially stable and
  // the keydown effect below doesn't re-bind on every index change.
  const navRef = useRef({ viewable, currentIndex })
  navRef.current = { viewable, currentIndex }

  const goTo = useCallback((delta: number) => {
    const { viewable: vs, currentIndex: idx } = navRef.current
    if (vs.length <= 1 || idx < 0) return
    const next = (idx + delta + vs.length) % vs.length
    setCurrentUuid(vs[next].uuid)
  }, [])

  const zoom = useCallback((factor: number) => {
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)))
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setRotation(0)
  }, [])

  const toggleZoom = useCallback(() => {
    setScale((s) => (s === 1 ? 2 : 1))
  }, [])

  // Scoped to the dialog via onKeyDown below — a window-level listener would
  // hijack +/-/r/0 from inputs elsewhere on the page even while the dialog is open.
  const handleDialogKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
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
          setRotation((r) => (r + 90) % 360)
        }
      }
    },
    [hasMultiple, goTo, kind, zoom, resetView]
  )

  const handleDownload = async () => {
    if (!current) return
    if (isExternal && current.fileReference) {
      window.open(current.fileReference, '_blank', 'noopener,noreferrer')
      return
    }
    if (!current.fileReference) return
    try {
      await downloadFileToClient(
        client,
        current.fileReference,
        getDisplayName(current)
      )
    } catch (err) {
      logger.error('Attachment preview download failed', { error: err })
      toast.error(t('common.downloadFailed'))
    }
  }

  if (!current) return null

  const displayName = getDisplayName(current)
  const showImageControls = kind === 'image' && !!url
  const previewBodyTestId = error
    ? 'attachment-preview-error'
    : kind === 'unsupported'
      ? 'attachment-preview-fallback'
      : `attachment-preview-${kind}`

  const body = (() => {
    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6 text-sm text-destructive">
          {t('attachments.preview.loadFailed')}
        </div>
      )
    }
    switch (kind) {
      case 'image':
        return url ? (
          <ImageViewer
            src={url}
            alt={displayName}
            scale={scale}
            rotation={rotation}
            isLoading={isLoading}
            onZoom={zoom}
            onToggleZoom={toggleZoom}
          />
        ) : (
          <ImageViewer
            src=""
            alt={displayName}
            scale={1}
            rotation={0}
            isLoading
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
        data-testid="attachment-preview-dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <VisuallyHidden>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            {t('attachments.preview.dialogDescription')}
          </DialogDescription>
        </VisuallyHidden>

        {/* Unified top toolbar */}
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
                onClick={() => setRotation((r) => (r + 90) % 360)}
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
            onClick={handleDownload}
            data-testid="attachment-preview-download"
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

        {/* Body */}
        <div
          data-testid={previewBodyTestId}
          className="relative flex-1 overflow-hidden"
        >
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
                data-testid="attachment-preview-prev"
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
                data-testid="attachment-preview-next"
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

function LoadingPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>
  )
}
