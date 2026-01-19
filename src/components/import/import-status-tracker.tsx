'use client'

import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { useImportJobStore, importJobSelectors, type ImportJob } from '@/stores'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Progress,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui'

interface ImportStatusTrackerProps {
  className?: string
  maxVisible?: number
  showInFooter?: boolean
}

export function ImportStatusTracker({
  className = '',
  maxVisible = 5,
  showInFooter = false,
}: ImportStatusTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(!showInFooter)

  const jobs = useImportJobStore(importJobSelectors.jobs)
  const activeJobCount = useImportJobStore(importJobSelectors.activeJobCount)
  const clearCompletedJobs = useImportJobStore(
    (state) => state.clearCompletedJobs
  )
  const removeJob = useImportJobStore((state) => state.removeJob)

  const visibleJobs = jobs.slice(0, maxVisible)
  const hasMoreJobs = jobs.length > maxVisible

  if (jobs.length === 0) {
    return null
  }

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'starting':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'starting':
      case 'processing':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'cancelled':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getProgress = (job: ImportJob) => {
    if (job.totalItems === 0) return 0
    return Math.round((job.processedItems / job.totalItems) * 100)
  }

  const getDuration = (job: ImportJob) => {
    const endTime = job.endTime || new Date()
    const duration = endTime.getTime() - job.startTime.getTime()
    return Math.round(duration / 1000) // seconds
  }

  if (showInFooter) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className={`border-t bg-background ${className}`}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-4 h-auto"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Import Jobs ({jobs.length})</span>
                {activeJobCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeJobCount} active
                  </Badge>
                )}
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-0 max-h-96 overflow-y-auto">
              <ImportJobList
                jobs={visibleJobs}
                hasMoreJobs={hasMoreJobs}
                totalJobs={jobs.length}
                onRemoveJob={removeJob}
                onClearCompleted={clearCompletedJobs}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getProgress={getProgress}
                getDuration={getDuration}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Jobs
            {activeJobCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeJobCount} active
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCompletedJobs}
              disabled={
                jobs.filter((j) => j.status === 'completed').length === 0
              }
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear Completed
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ImportJobList
          jobs={visibleJobs}
          hasMoreJobs={hasMoreJobs}
          totalJobs={jobs.length}
          onRemoveJob={removeJob}
          onClearCompleted={clearCompletedJobs}
          getStatusIcon={getStatusIcon}
          getStatusColor={getStatusColor}
          getProgress={getProgress}
          getDuration={getDuration}
        />
      </CardContent>
    </Card>
  )
}

interface ImportJobListProps {
  jobs: ImportJob[]
  hasMoreJobs: boolean
  totalJobs: number
  onRemoveJob: (jobId: string) => void
  onClearCompleted: () => void
  getStatusIcon: (status: ImportJob['status']) => React.ReactNode
  getStatusColor: (status: ImportJob['status']) => string
  getProgress: (job: ImportJob) => number
  getDuration: (job: ImportJob) => number
}

function ImportJobList({
  jobs,
  hasMoreJobs,
  totalJobs,
  onRemoveJob,
  getStatusIcon,
  getStatusColor,
  getProgress,
  getDuration,
}: ImportJobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No import jobs yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 p-3 border rounded-lg bg-card"
        >
          <div className="flex-shrink-0">{getStatusIcon(job.status)}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {job.data?.fileName || `Import Job`}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${getStatusColor(job.status)} text-white border-transparent`}
                >
                  {job.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(job.startTime, { addSuffix: true })}
                </span>
                {job.status !== 'starting' && job.status !== 'processing' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onRemoveJob(job.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>
                {job.processedItems} / {job.totalItems} objects
                {job.failedItems > 0 && (
                  <span className="text-red-500 ml-1">
                    ({job.failedItems} failed)
                  </span>
                )}
              </span>

              {job.data?.estimatedSizeMB && (
                <span>{job.data.estimatedSizeMB.toFixed(2)} MB</span>
              )}
            </div>

            {(job.status === 'starting' || job.status === 'processing') && (
              <Progress value={getProgress(job)} className="h-2" />
            )}

            {job.status === 'completed' && (
              <div className="text-xs text-green-600">
                ✅ Completed in {getDuration(job)}s
              </div>
            )}

            {job.status === 'failed' && job.error && (
              <div className="text-xs text-red-600 truncate">
                ❌ {job.error}
              </div>
            )}
          </div>
        </div>
      ))}

      {hasMoreJobs && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          Showing {jobs.length} of {totalJobs} jobs
        </div>
      )}
    </div>
  )
}
