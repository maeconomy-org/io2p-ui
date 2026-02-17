import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts'
import { logger } from '@/lib'
import { ImportJobSummary, isActiveJobStatus } from './types'

export interface ImportManagerJobDetails extends ImportJobSummary {
  // Additional fields from detailed status API if needed
}

interface UseImportManagerResult {
  // Jobs list
  jobs: ImportJobSummary[]
  jobsLoading: boolean
  jobsError: string | null
  refreshJobs: () => void

  // Selected job details
  selectedJob: ImportManagerJobDetails | null
  selectedJobLoading: boolean
  selectedJobError: string | null
  refreshSelectedJob: () => void

  // Auto-refresh for active jobs
  isAutoRefreshing: boolean
  toggleAutoRefresh: () => void

  // Job selection
  selectJob: (jobId: string | null) => void
  selectedJobId: string | null

  // Job cancellation
  cancelJob: (jobId: string) => Promise<void>
  cancellingJobId: string | null
}

export function useImportManager(
  initialJobId?: string | null
): UseImportManagerResult {
  const { userUUID } = useAuth()

  // Jobs list state
  const [jobs, setJobs] = useState<ImportJobSummary[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)

  // Selected job state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobId || null
  )
  const [selectedJob, setSelectedJob] =
    useState<ImportManagerJobDetails | null>(null)
  const [selectedJobLoading, setSelectedJobLoading] = useState(false)
  const [selectedJobError, setSelectedJobError] = useState<string | null>(null)

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Cancel job state
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null)

  // Fetch all jobs
  const fetchJobs = useCallback(async () => {
    try {
      setJobsLoading(true)
      const params = new URLSearchParams()
      if (userUUID) {
        params.set('userUUID', userUUID)
      }
      params.set('limit', '100')

      const response = await fetch(`/api/import/jobs?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch jobs')
      }

      const data = await response.json()
      setJobs(data.jobs)
      setJobsError(null)
    } catch (err) {
      logger.error('Error fetching import jobs:', err)
      setJobsError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setJobsLoading(false)
    }
  }, [userUUID])

  // Fetch selected job details
  const fetchSelectedJob = useCallback(
    async (showLoading = true) => {
      if (!selectedJobId) {
        setSelectedJob(null)
        setSelectedJobLoading(false)
        return
      }

      try {
        if (showLoading) {
          setSelectedJobLoading(true)
        }
        const response = await fetch(`/api/import/jobs?jobId=${selectedJobId}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch job details')
        }

        const data = await response.json()
        setSelectedJob(data)
        setSelectedJobError(null)

        // Enable auto-refresh for active jobs
        setAutoRefresh(isActiveJobStatus(data.status))
      } catch (err) {
        logger.error('Error fetching job details:', err)
        setSelectedJobError(
          err instanceof Error ? err.message : 'Failed to fetch job details'
        )
        setAutoRefresh(false)
      } finally {
        if (showLoading) {
          setSelectedJobLoading(false)
        }
      }
    },
    [selectedJobId]
  )

  // Select a job
  const selectJob = useCallback((jobId: string | null) => {
    setSelectedJobId(jobId)
    setSelectedJob(null)
    setSelectedJobError(null)
  }, [])

  // Initial jobs fetch
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Fetch selected job when it changes
  useEffect(() => {
    if (selectedJobId) {
      fetchSelectedJob(true)
    }
  }, [selectedJobId])

  // Auto-refresh for active jobs
  useEffect(() => {
    if (!autoRefresh || !selectedJobId) return

    const intervalId = setInterval(() => {
      fetchSelectedJob(false) // Don't show loading spinner on auto-refresh
    }, 2000) // Refresh every 2 seconds

    return () => clearInterval(intervalId)
  }, [autoRefresh, selectedJobId])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((prev) => !prev)
  }, [])

  // Cancel a job
  const cancelJob = useCallback(
    async (jobId: string) => {
      try {
        setCancellingJobId(jobId)
        const response = await fetch('/api/import/cancel', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to cancel job')
        }

        // Refresh jobs list and selected job
        await fetchJobs()
        if (selectedJobId === jobId) {
          await fetchSelectedJob(true)
        }
      } catch (err) {
        logger.error('Error cancelling job:', err)
        throw err
      } finally {
        setCancellingJobId(null)
      }
    },
    [fetchJobs, fetchSelectedJob, selectedJobId]
  )

  return {
    // Jobs list
    jobs,
    jobsLoading,
    jobsError,
    refreshJobs: fetchJobs,

    // Selected job
    selectedJob,
    selectedJobLoading,
    selectedJobError,
    refreshSelectedJob: () => fetchSelectedJob(true),

    // Auto-refresh
    isAutoRefreshing: autoRefresh,
    toggleAutoRefresh,

    // Job selection
    selectJob,
    selectedJobId,

    // Job cancellation
    cancelJob,
    cancellingJobId,
  }
}
