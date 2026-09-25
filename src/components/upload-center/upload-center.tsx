'use client'

import { createElement, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  File as FileIcon,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  RotateCw,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'

import { useOptionalUploadQueue } from '@/contexts/upload-queue-context'
import { Button, Card, Progress } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatBytes, truncateText } from '@/lib/utils'
import type { UploadTask } from '@/lib/upload-queue'

function mimeIcon(mimeType?: string): LucideIcon {
  if (!mimeType) return FileIcon
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return FileVideo
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/'))
    return FileText
  return FileIcon
}

export function UploadCenter() {
  const t = useTranslations()
  const upload = useOptionalUploadQueue()
  const [isExpanded, setIsExpanded] = useState(true)
  const [announcement, setAnnouncement] = useState('')
  const previousStatuses = useRef<Map<string, UploadTask['status']>>(new Map())

  // Live announcer: emit a single sentence whenever a task crosses into a
  // terminal state. We diff status against the previous render rather than
  // listening on the service so the announcement aligns with what the user
  // just visually saw.
  useEffect(() => {
    if (!upload) return
    const next = new Map<string, UploadTask['status']>()
    let message = ''
    for (const task of upload.tasks) {
      const prev = previousStatuses.current.get(task.id)
      next.set(task.id, task.status)
      if (prev === task.status) continue
      const fileName = task.fileName || task.id
      if (task.status === 'completed') {
        message = t('uploads.centerAnnounceCompleted', { fileName })
      } else if (task.status === 'failed') {
        const isCancelled = task.error === 'Cancelled'
        message = t(
          isCancelled
            ? 'uploads.centerAnnounceCancelled'
            : 'uploads.centerAnnounceFailed',
          { fileName }
        )
      }
    }
    previousStatuses.current = next
    // This detects a TRANSITION (a task crossing into completed/failed) by
    // comparing against the previous render's statuses. That is not derivable
    // from current state, so "you might not need an effect" does not apply:
    // no render-time expression yields "this just changed". Revisit with the
    // rest of the set-state-in-effect pass — the honest fix is a task-level
    // event from UploadQueue rather than diffing here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (message) setAnnouncement(message)
  }, [upload, t])

  if (!upload) return null

  const { tasks, summary, isIdle, clearCompleted, cancel, retry, remove } =
    upload

  // Always render the idle sentinel so e2e tests can deterministically wait
  // for "no uploads pending" (replacement for brittle waitForTimeout).
  if (tasks.length === 0) {
    return (
      <div
        data-testid="upload-center-idle"
        aria-hidden="true"
        className="sr-only"
      />
    )
  }

  const done = summary.completed + summary.failed
  const progress = summary.total > 0 ? (done / summary.total) * 100 : 0
  const isProcessing = summary.uploading > 0 || summary.pending > 0

  return (
    <>
      {isIdle && summary.failed === 0 && (
        <div
          data-testid="upload-center-idle"
          aria-hidden="true"
          className="sr-only"
        />
      )}
      <Card
        data-testid="upload-center"
        className="fixed bottom-4 left-4 w-96 shadow-lg border z-[60] pointer-events-auto"
      >
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="upload-center-announcer"
        >
          {announcement}
        </div>
        <div
          data-testid="upload-center-toggle"
          className="p-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {isProcessing ? (
                <Upload className="h-4 w-4 animate-pulse text-blue-600 shrink-0" />
              ) : summary.failed > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              ) : (
                <Upload className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <span className="text-sm font-medium truncate">
                {isProcessing
                  ? t('uploads.centerInProgress', {
                      done,
                      total: summary.total,
                    })
                  : summary.failed > 0
                    ? t('uploads.centerFailed', {
                        count: summary.failed,
                      })
                    : t('uploads.centerIdle')}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isIdle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearCompleted()
                  }}
                  aria-label={t('uploads.centerClear')}
                  data-testid="upload-center-clear"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {isProcessing && (
            <div className="mt-2">
              <Progress value={progress} className="h-1" />
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 border-t">
            <ul
              className="mt-2 max-h-64 overflow-y-auto space-y-2"
              data-testid="upload-center-tasks"
            >
              {tasks.map((task) => (
                <UploadTaskRow
                  key={task.id}
                  task={task}
                  onCancel={cancel}
                  onRetry={retry}
                  onRemove={remove}
                />
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  )
}

type UploadTaskRowProps = {
  task: UploadTask
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}

function UploadTaskRow({
  task,
  onCancel,
  onRetry,
  onRemove,
}: UploadTaskRowProps) {
  const t = useTranslations()
  const name = task.fileName || task.id
  const isCancelled = task.status === 'failed' && task.error === 'Cancelled'
  const sizeLabel = formatBytes(task.size)

  return (
    <li
      data-testid={`upload-task-${task.id}`}
      className="flex items-start gap-2 text-xs"
    >
      <span data-testid={`upload-task-status-${task.id}`} className="sr-only">
        {task.status}
      </span>
      <span data-testid={`upload-task-progress-${task.id}`} className="sr-only">
        {task.progress}
      </span>
      <div className="relative shrink-0 pt-0.5">
        {/* createElement, not a capitalised local: `mimeIcon` picks one of five
            module-level lucide icons, but assigning it to `const Icon` and
            rendering <Icon/> reads to react-hooks/static-components as a
            component built during render (which would reset state on every
            render). Nothing is constructed here — this makes that explicit. */}
        {createElement(mimeIcon(task.contentType), {
          className: 'h-5 w-5 text-muted-foreground',
          'aria-hidden': true,
        })}
        <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-background">
          <StatusIcon status={task.status} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium" title={name}>
            {truncateText(name, 36)}
          </span>
          {task.status === 'uploading' && (
            <span className="tabular-nums text-muted-foreground">
              {task.progress}%
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusBadge task={task} />
          {sizeLabel && <span>{sizeLabel}</span>}
        </div>
        {task.status === 'uploading' && (
          <Progress value={task.progress} className="h-0.5 mt-1" />
        )}
        {task.status === 'failed' && !isCancelled && task.error && (
          <p
            className="mt-0.5 truncate text-red-600 dark:text-red-400"
            title={task.error}
          >
            {truncateText(task.error, 60)}
          </p>
        )}
      </div>

      {(task.status === 'pending' || task.status === 'uploading') && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onCancel(task.id)}
          aria-label={t('uploads.centerCancel')}
          data-testid={`upload-task-cancel-${task.id}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      {task.status === 'failed' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onRetry(task.id)}
          aria-label={t('uploads.centerRetry')}
          data-testid={`upload-task-retry-${task.id}`}
        >
          <RotateCw className="h-3 w-3" />
        </Button>
      )}
      {(task.status === 'completed' || task.status === 'failed') && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onRemove(task.id)}
          aria-label={t('uploads.centerRemove')}
          data-testid={`upload-task-remove-${task.id}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </li>
  )
}

function StatusBadge({ task }: { task: UploadTask }) {
  const t = useTranslations()
  const isCancelled = task.status === 'failed' && task.error === 'Cancelled'
  switch (task.status) {
    case 'pending':
      return <span>{t('uploads.centerStatusPending')}</span>
    case 'uploading':
      return (
        <span className="text-blue-600 dark:text-blue-400">
          {t('uploads.centerStatusUploading')}
        </span>
      )
    case 'cancelling':
      return <span>{t('uploads.centerCancelling')}</span>
    case 'completed':
      return (
        <span className="text-green-600 dark:text-green-400">
          {t('uploads.centerStatusDone')}
        </span>
      )
    case 'failed':
      return (
        <span className="text-red-600 dark:text-red-400">
          {isCancelled
            ? t('uploads.centerStatusCancelled')
            : t('uploads.centerStatusFailed')}
        </span>
      )
    default:
      return null
  }
}

function StatusIcon({ status }: { status: UploadTask['status'] }) {
  const t = useTranslations()
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
    case 'failed':
      return <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
    case 'cancelling':
      return (
        <Loader2
          className={cn('h-3 w-3 animate-spin text-muted-foreground shrink-0')}
          aria-label={t('uploads.centerCancelling')}
        />
      )
    case 'uploading':
      return <Loader2 className="h-3 w-3 animate-spin text-blue-600 shrink-0" />

    default:
      return <Upload className="h-3 w-3 text-muted-foreground shrink-0" />
  }
}
