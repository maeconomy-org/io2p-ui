'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { ImportStatusTracker } from '@/components/import/import-status-tracker'
import { useImportJobStore, importJobSelectors, type ImportJob } from '@/stores'

export default function ImportStatusPage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')

  // Get all import jobs for the current user
  const jobs = useImportJobStore(importJobSelectors.jobs)

  // Load jobs on mount
  useEffect(() => {
    // The store already manages jobs, but we can trigger a refresh if needed
    // For now, we'll use the existing jobs in the store
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />
      case 'starting':
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'processing':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'starting':
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Import Status
          </h1>
          <p className="text-gray-600">
            Track the progress of your import jobs and view detailed status
            information.
          </p>
        </div>

        {/* Specific Job Tracker (if jobId provided) */}
        {jobId && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Import Job Details</CardTitle>
                <CardDescription>Tracking job: {jobId}</CardDescription>
              </CardHeader>
              <CardContent>
                <ImportStatusTracker />
              </CardContent>
            </Card>
          </div>
        )}

        {/* All User Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Import Jobs
            </CardTitle>
            <CardDescription>
              All import jobs initiated by your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Import Jobs Found
                </h3>
                <p className="text-gray-600">
                  You haven't started any import jobs yet. Visit the{' '}
                  <a
                    href="/import"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    import page
                  </a>{' '}
                  to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job: ImportJob) => (
                  <div
                    key={job.id}
                    className={`p-4 rounded-lg border ${getStatusColor(job.status)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(job.status)}
                        <div>
                          <h4 className="font-medium">
                            Job {job.id.substring(0, 8)}...
                          </h4>
                          <p className="text-sm opacity-75">
                            {job.totalItems} objects • Started{' '}
                            {job.startTime.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium capitalize">
                          {job.status}
                        </div>
                        {job.status === 'processing' && (
                          <div className="text-xs opacity-75">
                            {job.processedItems}/{job.totalItems} processed
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {job.status === 'processing' && job.totalItems > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(job.processedItems / job.totalItems) * 100}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {job.status === 'failed' && job.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {job.error}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <a
                        href={`/import-status?jobId=${job.id}`}
                        className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50 transition-colors"
                      >
                        View Details
                      </a>
                      {job.status === 'completed' && (
                        <a
                          href={`/objects`}
                          className="text-sm px-3 py-1 bg-white border border-current rounded hover:bg-gray-50 transition-colors"
                        >
                          View Objects
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
