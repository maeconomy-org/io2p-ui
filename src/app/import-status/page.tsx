'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowLeft,
  Package,
  Clock,
  CalendarCheck,
  Ban,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useImportManager } from '@/hooks'
import { Button, Progress } from '@/components/ui'
import { ContentSkeleton } from '@/components/skeletons'

// Job status icon component
function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'receiving':
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'completed_with_errors':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'cancelled':
      return <Ban className="h-4 w-4 text-muted-foreground" />
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
  }
}

// Format date helper
function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString()
}

// Format job title
function formatJobStatus(job: any): string {
  return (
    job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')
  )
}

export default function ImportStatusPage() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialJobId = searchParams.get('jobId')

  // Use unified import manager hook
  const {
    jobs,
    jobsLoading,
    jobsError,
    refreshJobs,
    selectedJob,
    selectedJobLoading,
    selectedJobError,
    refreshSelectedJob,
    isAutoRefreshing,
    toggleAutoRefresh,
    selectJob,
    selectedJobId,
    cancelJob,
    cancellingJobId,
  } = useImportManager(initialJobId)

  // Check if we should redirect to objects page after completion
  useEffect(() => {
    if (selectedJob?.status === 'completed') {
      const shouldRedirect = searchParams.get('redirect') === 'true'
      if (shouldRedirect) {
        const timer = setTimeout(() => {
          router.push('/objects')
        }, 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [selectedJob, router, searchParams])

  // Toggle job expansion
  const toggleJob = (jobId: string) => {
    if (selectedJobId === jobId) {
      selectJob(null)
      // Clear jobId from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('jobId')
      window.history.replaceState({}, '', newUrl.toString())
    } else {
      selectJob(jobId)
      // Update URL with jobId
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('jobId', jobId)
      window.history.replaceState({}, '', newUrl.toString())
    }
  }

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/import">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {t('importStatus.back')}
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('importStatus.title')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('importStatus.jobsFound', { count: jobs.length })}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshJobs}
              disabled={jobsLoading}
              className="gap-2"
            >
              <RefreshCcw
                className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`}
              />
              {t('common.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {jobsLoading && jobs.length === 0 ? (
            <ContentSkeleton />
          ) : jobsError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {t('importStatus.failedJobs')}
                </h3>
                <p className="text-muted-foreground mb-4">{jobsError}</p>
                <Button onClick={refreshJobs} variant="outline">
                  {t('importStatus.tryAgain')}
                </Button>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t('importStatus.noJobs')}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t('importStatus.startFirst')}
              </p>
              <Link href="/import">
                <Button>{t('importStatus.startNew')}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.jobId}
                  className="bg-card rounded-lg border shadow-sm overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(job.jobId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <JobStatusIcon status={job.status} />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {t('importStatus.jobTitle', {
                            id: job.jobId.substring(0, 8),
                            status: formatJobStatus(job),
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {selectedJobId === job.jobId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {selectedJobId === job.jobId && (
                    <div className="border-t bg-muted/30">
                      {selectedJobLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : selectedJobError ? (
                        <div className="p-6 text-center">
                          <p className="text-destructive mb-4">
                            {selectedJobError}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={refreshSelectedJob}
                          >
                            {t('common.retry')}
                          </Button>
                        </div>
                      ) : selectedJob ? (
                        <div className="p-6 space-y-6">
                          {/* Progress Section */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {t('importStatus.progress')}
                              </span>
                              <span className="text-lg font-semibold">
                                {Math.round(
                                  (selectedJob.processed /
                                    (selectedJob.total || 1)) *
                                    100
                                )}
                                %
                              </span>
                            </div>
                            <Progress
                              value={
                                (selectedJob.processed /
                                  (selectedJob.total || 1)) *
                                100
                              }
                              className="h-3"
                            />
                          </div>

                          {/* Stat Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Total Objects */}
                            <div className="rounded-lg border bg-card p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40">
                                  <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('importStatus.totalObjects')}
                                </span>
                              </div>
                              <div className="text-xl font-semibold">
                                {selectedJob.total.toLocaleString()}
                              </div>
                            </div>

                            {/* Successful */}
                            <div className="rounded-lg border bg-card p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('importStatus.successful')}
                                </span>
                              </div>
                              <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                                {Math.max(
                                  0,
                                  selectedJob.processed - selectedJob.failed
                                ).toLocaleString()}
                              </div>
                            </div>

                            {/* Failed */}
                            <div className="rounded-lg border bg-card p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className={cn(
                                    'p-1.5 rounded-md',
                                    selectedJob.failed > 0
                                      ? 'bg-red-100 dark:bg-red-900/40'
                                      : 'bg-muted'
                                  )}
                                >
                                  <XCircle
                                    className={cn(
                                      'h-3.5 w-3.5',
                                      selectedJob.failed > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-muted-foreground'
                                    )}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('importStatus.failed')}
                                </span>
                              </div>
                              <div
                                className={cn(
                                  'text-xl font-semibold',
                                  selectedJob.failed > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {selectedJob.failed.toLocaleString()}
                              </div>
                            </div>

                            {/* Processed */}
                            <div className="rounded-lg border bg-card p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/40">
                                  <Loader2
                                    className={cn(
                                      'h-3.5 w-3.5 text-violet-600 dark:text-violet-400',
                                      [
                                        'pending',
                                        'receiving',
                                        'processing',
                                      ].includes(selectedJob.status) &&
                                        'animate-spin'
                                    )}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('importStatus.processed')}
                                </span>
                              </div>
                              <div className="text-xl font-semibold">
                                {selectedJob.processed.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Timestamps */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {t('importStatus.started')}
                              </span>
                              <span className="font-medium">
                                {formatDate(selectedJob.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {t('importStatus.completed')}
                              </span>
                              <span className="font-medium">
                                {formatDate(selectedJob.completedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Error Display */}
                          {selectedJob.error && (
                            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                              <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                                <AlertCircle className="h-4 w-4" />
                                {t('importStatus.errorDetails')}
                              </div>
                              <div className="text-sm text-destructive/80 font-mono">
                                {selectedJob.error}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex gap-3">
                              {(selectedJob.status === 'completed' ||
                                selectedJob.status ===
                                  'completed_with_errors') && (
                                <Link href="/objects">
                                  <Button size="sm">
                                    {t('importStatus.viewObjects')}
                                  </Button>
                                </Link>
                              )}
                              {['pending', 'receiving', 'processing'].includes(
                                selectedJob.status
                              ) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await cancelJob(selectedJob.jobId)
                                    } catch (error) {
                                      console.error(
                                        'Failed to cancel job:',
                                        error
                                      )
                                    }
                                  }}
                                  disabled={
                                    cancellingJobId === selectedJob.jobId
                                  }
                                  className="gap-2"
                                >
                                  {cancellingJobId === selectedJob.jobId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Ban className="h-3 w-3" />
                                  )}
                                  {t('importStatus.cancelJob')}
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {['pending', 'receiving', 'processing'].includes(
                                selectedJob.status
                              ) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={toggleAutoRefresh}
                                  className={cn(
                                    isAutoRefreshing &&
                                      'text-primary border-primary'
                                  )}
                                >
                                  <RefreshCcw
                                    className={cn(
                                      'h-3 w-3 mr-2',
                                      isAutoRefreshing && 'animate-spin'
                                    )}
                                  />
                                  {isAutoRefreshing
                                    ? t('importStatus.autoRefreshing')
                                    : t('importStatus.autoRefresh')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={refreshSelectedJob}
                              >
                                {t('common.refresh')}
                              </Button>
                            </div>
                          </div>

                          {/* Job ID */}
                          <div className="pt-4 border-t">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">
                                {t('importStatus.jobId')}
                              </span>{' '}
                              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                                {selectedJob.jobId}
                              </code>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground">
                          <p>{t('importStatus.loadingDetails')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
