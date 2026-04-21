'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp, ChevronDown, Upload, AlertTriangle, X } from 'lucide-react'

import { useOptionalUploadQueue } from '@/contexts'
import { Button, Card, Progress } from '@/components/ui'

export function UploadCenter() {
  const t = useTranslations()
  const upload = useOptionalUploadQueue()
  const [isExpanded, setIsExpanded] = useState(true)

  if (!upload) return null

  const { tasks, summary, isIdle, clearCompleted } = upload

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
        className="fixed bottom-4 left-4 w-80 shadow-lg border z-50"
      >
        <div
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
            <div className="space-y-2 mt-2">
              {summary.pending + summary.uploading > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('objects.uploadCenterPending')}
                  </span>
                  <span className="font-medium">
                    {summary.pending + summary.uploading}
                  </span>
                </div>
              )}
              {summary.completed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('objects.uploadCenterCompleted')}
                  </span>
                  <span className="font-medium text-green-600">
                    {summary.completed}
                  </span>
                </div>
              )}
              {summary.failed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('objects.uploadCenterFailedLabel')}
                  </span>
                  <span className="font-medium text-red-600">
                    {summary.failed}
                  </span>
                </div>
              )}
            </div>

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
