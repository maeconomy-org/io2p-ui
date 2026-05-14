'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ChevronUp,
  ChevronDown,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react'

import { useOptionalUploadQueue } from '@/contexts'
import { Button, Card, Progress } from '@/components/ui'
import { cn } from '@/lib/utils'
import { truncateText } from '@/lib'
import type { FileUploadTask } from '@/lib/upload-service'

export function UploadCenter() {
  const t = useTranslations()
  const upload = useOptionalUploadQueue()
  const [isExpanded, setIsExpanded] = useState(true)

  if (!upload) return null

  const { tasks, summary, isIdle, clearCompleted, cancelTask, retryTask } =
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
        className="fixed bottom-4 left-4 w-80 shadow-lg border z-[60] pointer-events-auto"
      >
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
                  ? t('objects.uploadCenterInProgress', {
                      done,
                      total: summary.total,
                    })
                  : summary.failed > 0
                    ? t('objects.uploadCenterFailed', {
                        count: summary.failed,
                      })
                    : t('objects.uploadCenterIdle')}
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
                  aria-label={t('objects.uploadCenterClear')}
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
              className="mt-2 max-h-48 overflow-y-auto space-y-1"
              data-testid="upload-center-tasks"
            >
              {tasks.map((task) => (
                <UploadTaskRow
                  key={task.id}
                  task={task}
                  onCancel={cancelTask}
                  onRetry={retryTask}
                />
              ))}
            </ul>

            {isProcessing && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">
                    {t('objects.uploadCenterImportant')}
                  </span>
                </div>
                <div className="mt-1">
                  {t('objects.uploadCenterDoNotReload')}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  )
}

type UploadTaskRowProps = {
  task: FileUploadTask
  onCancel: (id: string) => void
  onRetry: (id: string) => void
}

function UploadTaskRow({ task, onCancel, onRetry }: UploadTaskRowProps) {
  const t = useTranslations()
  const name = task.attachment?.fileName || task.id
  const isCancelled = task.status === 'failed' && task.error === 'Cancelled'

  return (
    <li
      data-testid={`upload-task-${task.id}`}
      className="flex items-center gap-2 text-xs"
    >
      <span data-testid={`upload-task-status-${task.id}`} className="sr-only">
        {task.status}
      </span>
      <span data-testid={`upload-task-progress-${task.id}`} className="sr-only">
        {task.progress}
      </span>
      <StatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate" title={name}>
            {truncateText(name, 32)}
          </span>
          {task.status === 'uploading' && (
            <span className="tabular-nums text-muted-foreground">
              {task.progress}%
            </span>
          )}
        </div>
        {task.status === 'uploading' && (
          <Progress value={task.progress} className="h-0.5 mt-0.5" />
        )}
        {task.status === 'failed' && !isCancelled && task.error && (
          <p
            className="truncate text-red-600 dark:text-red-400"
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
          aria-label={t('objects.uploadCenterCancel')}
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
          aria-label={t('objects.uploadCenterRetry')}
          data-testid={`upload-task-retry-${task.id}`}
        >
          <RotateCw className="h-3 w-3" />
        </Button>
      )}
    </li>
  )
}

function StatusIcon({ status }: { status: FileUploadTask['status'] }) {
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
          aria-label={t('objects.uploadCenterCancelling')}
        />
      )
    case 'uploading':
      return <Loader2 className="h-3 w-3 animate-spin text-blue-600 shrink-0" />

    default:
      return <Upload className="h-3 w-3 text-muted-foreground shrink-0" />
  }
}
