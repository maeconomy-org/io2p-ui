'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Upload, AlertTriangle } from 'lucide-react'
import { getUploadService } from '@/lib'
import { useIomSdkClient } from '@/providers/query-provider'
import { Button, Card, Progress } from '@/components/ui'

export function UploadProgressIndicator() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [uploadStats, setUploadStats] = useState({
    completed: 0,
    failed: 0,
    pending: 0,
    isProcessing: false,
  })
  const client = useIomSdkClient()

  useEffect(() => {
    if (!client) return

    const uploadService = getUploadService(client)

    // Poll upload status every 500ms
    const interval = setInterval(() => {
      const summary = uploadService.getUploadSummary()
      setUploadStats({
        completed: summary.completed.length,
        failed: summary.failed.length,
        pending: summary.pending.length,
        isProcessing: summary.isProcessing,
      })
    }, 500)

    return () => clearInterval(interval)
  }, [client])

  // Don't show if no uploads are happening
  if (
    uploadStats.pending === 0 &&
    !uploadStats.isProcessing &&
    uploadStats.completed === 0 &&
    uploadStats.failed === 0
  ) {
    return null
  }

  const totalFiles =
    uploadStats.completed + uploadStats.failed + uploadStats.pending
  const progress =
    totalFiles > 0
      ? ((uploadStats.completed + uploadStats.failed) / totalFiles) * 100
      : 0

  return (
    <Card className="fixed bottom-4 left-4 w-80 shadow-lg border z-50">
      {/* Collapsed Header */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {uploadStats.isProcessing ? (
              <Upload className="h-4 w-4 animate-pulse text-blue-600" />
            ) : uploadStats.failed > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <Upload className="h-4 w-4 text-green-600" />
            )}
            <span className="text-sm font-medium">
              {uploadStats.isProcessing
                ? `Uploading ${uploadStats.pending} files...`
                : uploadStats.failed > 0
                  ? `${uploadStats.failed} failed, ${uploadStats.completed} completed`
                  : `${uploadStats.completed} files uploaded`}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Progress bar */}
        {uploadStats.pending > 0 && (
          <div className="mt-2">
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t">
          <div className="space-y-2 mt-2">
            {uploadStats.pending > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-medium">{uploadStats.pending}</span>
              </div>
            )}
            {uploadStats.completed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium text-green-600">
                  {uploadStats.completed}
                </span>
              </div>
            )}
            {uploadStats.failed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-red-600">
                  {uploadStats.failed}
                </span>
              </div>
            )}
          </div>

          {uploadStats.isProcessing && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">Important:</span>
              </div>
              <div className="mt-1">
                Do not reload or navigate away from this page while files are
                uploading.
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
