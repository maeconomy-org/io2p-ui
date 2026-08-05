'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { logger } from '@/lib/logger'
import { authFetch } from '@/lib/auth-fetch'
import { queryKeys } from '@/lib/query-keys'

import { ImportJobSummary, isActiveJobStatus } from './types'

export interface ImportManagerJobDetails extends ImportJobSummary {
  // Additional fields from detailed status API if needed
}

/** How often a RUNNING job is re-read. Finished jobs stop polling on their own — see below. */
const ACTIVE_POLL_MS = 2000

async function readJson(response: Response, fallback: string) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || fallback)
  }
  return response.json()
}

interface UseImportManagerResult {
  jobs: ImportJobSummary[]
  jobsLoading: boolean
  jobsError: string | null
  refreshJobs: () => void

  selectedJob: ImportManagerJobDetails | null
  selectedJobLoading: boolean
  selectedJobError: string | null
  refreshSelectedJob: () => void

  isAutoRefreshing: boolean
  toggleAutoRefresh: () => void

  selectJob: (jobId: string | null) => void
  selectedJobId: string | null

  cancelJob: (jobId: string) => Promise<void>
  cancellingJobId: string | null
}

/**
 * The import-status screen's data, on React Query rather than hand-rolled effects.
 *
 * It used to hold nine `useState`s and three effects, and paid for them: a fetch that set a loading
 * flag synchronously from inside an effect, a poll interval reading a stale closure, and an
 * auto-refresh flag written as a side effect of the fetch that read it.
 *
 * Polling is now `refetchInterval`, driven by the job's OWN status — an active job polls, a finished
 * one stops, with nothing to keep in sync. The manual toggle is an override on top, so `null` means
 * "follow the job" and only an explicit click pins it.
 */
export function useImportManager(
  initialJobId?: string | null
): UseImportManagerResult {
  const qc = useQueryClient()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobId || null
  )
  const [autoRefreshOverride, setAutoRefreshOverride] = useState<
    boolean | null
  >(null)
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null)

  const jobsQuery = useQuery({
    queryKey: queryKeys.importJobs.list(),
    queryFn: async () => {
      const res = await authFetch('/api/import/jobs?limit=100')
      const data = await readJson(res, 'Failed to fetch jobs')
      return data.jobs as ImportJobSummary[]
    },
  })

  const selectedQuery = useQuery({
    queryKey: queryKeys.importJobs.detail(selectedJobId ?? ''),
    queryFn: async () => {
      const res = await authFetch(`/api/import/jobs?jobId=${selectedJobId}`)
      return (await readJson(
        res,
        'Failed to fetch job details'
      )) as ImportManagerJobDetails
    },
    enabled: !!selectedJobId,
    // Derived from the data it polls, so a job that finishes stops the interval by itself.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const active = isActiveJobStatus(status)
      const on = autoRefreshOverride ?? active
      return on ? ACTIVE_POLL_MS : false
    },
  })

  const selectedJob = selectedJobId ? (selectedQuery.data ?? null) : null
  const isAutoRefreshing =
    autoRefreshOverride ?? isActiveJobStatus(selectedJob?.status)

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await authFetch('/api/import/cancel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      await readJson(res, 'Failed to cancel job')
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.importJobs.all }),
    onError: (error) => logger.error('Error cancelling job:', { err: error }),
  })

  const errorText = (error: unknown, fallback: string) =>
    error ? (error instanceof Error ? error.message : fallback) : null

  return {
    jobs: jobsQuery.data ?? [],
    jobsLoading: jobsQuery.isLoading,
    jobsError: errorText(jobsQuery.error, 'Failed to fetch jobs'),
    refreshJobs: () => void jobsQuery.refetch(),

    selectedJob,
    selectedJobLoading: !!selectedJobId && selectedQuery.isLoading,
    selectedJobError: errorText(
      selectedQuery.error,
      'Failed to fetch job details'
    ),
    refreshSelectedJob: () => void selectedQuery.refetch(),

    isAutoRefreshing,
    toggleAutoRefresh: () => setAutoRefreshOverride(!isAutoRefreshing),

    selectJob: (jobId) => {
      setSelectedJobId(jobId)
      // Drop the pin: the next job's own status decides again.
      setAutoRefreshOverride(null)
    },
    selectedJobId,

    cancelJob: async (jobId) => {
      setCancellingJobId(jobId)
      try {
        await cancelMutation.mutateAsync(jobId)
      } finally {
        setCancellingJobId(null)
      }
    },
    cancellingJobId,
  }
}
