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
} from 'lucide-react'

import { Button, Progress } from '@/components/ui'
import { useImportManager } from '@/hooks'

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
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />
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
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b">
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
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                {t('importStatus.loadingJobs')}
              </p>
            </div>
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
                  className="bg-white rounded-lg border shadow-sm overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(job.jobId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
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
                    <div className="border-t bg-gray-50/30">
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

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {t('importStatus.started')}
                                </div>
                                <div className="text-sm">
                                  {formatDate(selectedJob.createdAt)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {t('importStatus.totalObjects')}
                                </div>
                                <div className="text-sm font-medium">
                                  {selectedJob.total.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {t('importStatus.successful')}
                                </div>
                                <div className="text-sm font-medium text-green-600">
                                  {(
                                    selectedJob.processed - selectedJob.failed
                                  ).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {t('importStatus.completed')}
                                </div>
                                <div className="text-sm">
                                  {formatDate(selectedJob.completedAt)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {t('importStatus.failed')}
                                </div>
                                <div className="text-sm font-medium text-destructive">
                                  {selectedJob.failed.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Error Display */}
                          {selectedJob.error && (
                            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-md">
                              <div className="text-sm font-medium text-destructive mb-2">
                                {t('importStatus.errorDetails')}
                              </div>
                              <div className="text-sm text-destructive/80">
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
                            </div>
                            <div className="flex items-center gap-2">
                              {['pending', 'receiving', 'processing'].includes(
                                selectedJob.status
                              ) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={toggleAutoRefresh}
                                  className={
                                    isAutoRefreshing
                                      ? 'text-primary border-primary'
                                      : ''
                                  }
                                >
                                  <RefreshCcw
                                    className={`h-3 w-3 mr-2 ${isAutoRefreshing ? 'animate-spin' : ''}`}
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
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">
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
