'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts'
import { HEALTH_UI_ENABLED, HEALTH_ALLOWED_CERTS } from '@/constants'
import type { HealthData, FailureRecord } from '@/types'

interface UseHealthDashboardReturn {
  // State
  healthData: HealthData | null
  loading: boolean
  actionLoading: string | null
  error: string | null
  lastUpdated: Date | null
  expandedJob: string | null
  jobFailures: Record<string, FailureRecord[]>

  // Access control
  hasAccess: boolean
  isEnabled: boolean

  // Actions
  fetchHealthData: () => Promise<void>
  triggerCleanup: () => Promise<void>
  retryJob: (jobId: string) => Promise<void>
  deleteJob: (jobId: string) => Promise<void>
  toggleJobExpand: (jobId: string) => void
}

export function useHealthDashboard(): UseHealthDashboardReturn {
  const { certFingerprint, certSerialNumber, isAuthenticated } = useAuth()

  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [jobFailures, setJobFailures] = useState<
    Record<string, FailureRecord[]>
  >({})

  // Check if user has access
  const hasAccess = useCallback(() => {
    if (!HEALTH_UI_ENABLED) return false
    if (!isAuthenticated) return false

    // If no specific certs are configured, allow any authenticated user
    if (!HEALTH_ALLOWED_CERTS.trim()) return true

    // Check if user's cert is in allowed list
    const allowedCerts = HEALTH_ALLOWED_CERTS.split(',').map((c: string) =>
      c.trim()
    )
    return (
      allowedCerts.includes(certFingerprint || '') ||
      allowedCerts.includes(certSerialNumber || '')
    )
  }, [isAuthenticated, certFingerprint, certSerialNumber])

  const fetchHealthData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/system/health')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setHealthData(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch health data'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerCleanup = useCallback(async () => {
    setActionLoading('cleanup')
    setError(null)

    try {
      const response = await fetch('/api/system/health', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      alert(
        `Cleanup completed: ${result.result.jobsDeleted} jobs and ${result.result.chunksDeleted} chunks deleted`
      )

      // Refresh health data after cleanup
      await fetchHealthData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger cleanup')
    } finally {
      setActionLoading(null)
    }
  }, [fetchHealthData])

  const retryJob = useCallback(
    async (jobId: string) => {
      setActionLoading(`retry-${jobId}`)
      setError(null)

      try {
        const response = await fetch('/api/system/health/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `HTTP ${response.status}`)
        }

        const result = await response.json()
        alert(
          `Retry job created: ${result.newJobId}\nObjects to retry: ${result.objectCount}`
        )

        // Refresh health data
        await fetchHealthData()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retry job')
      } finally {
        setActionLoading(null)
      }
    },
    [fetchHealthData]
  )

  const deleteJob = useCallback(
    async (jobId: string) => {
      if (
        !confirm(
          `Are you sure you want to delete job ${jobId.slice(0, 8)}...? This cannot be undone.`
        )
      ) {
        return
      }

      setActionLoading(`delete-${jobId}`)
      setError(null)

      try {
        const response = await fetch('/api/system/health/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `HTTP ${response.status}`)
        }

        const result = await response.json()
        alert(
          `Job deleted successfully. Chunks removed: ${result.chunksDeleted}`
        )

        // Refresh health data
        await fetchHealthData()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete job')
      } finally {
        setActionLoading(null)
      }
    },
    [fetchHealthData]
  )

  const fetchJobFailures = useCallback(
    async (jobId: string) => {
      if (jobFailures[jobId]) return // Already fetched

      try {
        const response = await fetch(
          `/api/system/health/failures?jobId=${jobId}&limit=10`
        )
        if (response.ok) {
          const data = await response.json()
          setJobFailures((prev) => ({ ...prev, [jobId]: data.failures }))
        }
      } catch {
        // Silently fail
      }
    },
    [jobFailures]
  )

  const toggleJobExpand = useCallback(
    (jobId: string) => {
      if (expandedJob === jobId) {
        setExpandedJob(null)
      } else {
        setExpandedJob(jobId)
        fetchJobFailures(jobId)
      }
    },
    [expandedJob, fetchJobFailures]
  )

  // Auto-fetch on mount and refresh every 30 seconds
  useEffect(() => {
    if (hasAccess()) {
      fetchHealthData()

      const interval = setInterval(fetchHealthData, 30000)
      return () => clearInterval(interval)
    }
  }, [hasAccess, fetchHealthData])

  return {
    // State
    healthData,
    loading,
    actionLoading,
    error,
    lastUpdated,
    expandedJob,
    jobFailures,

    // Access control
    hasAccess: hasAccess(),
    isEnabled: HEALTH_UI_ENABLED,

    // Actions
    fetchHealthData,
    triggerCleanup,
    retryJob,
    deleteJob,
    toggleJobExpand,
  }
}
