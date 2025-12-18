import { useState, useEffect, useCallback } from 'react'

import { logger } from '@/lib'

interface ImportStatus {
  jobId: string
  status: 'pending' | 'receiving' | 'processing' | 'completed' | 'failed'
  total: number
  processed: number
  failed: number
  createdAt?: Date
  completedAt?: Date
  error?: string
}

export function useImportStatus(jobId: string | null) {
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)

  const fetchStatus = useCallback(async () => {
    if (!jobId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/import/status?jobId=${jobId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch status')
      }

      const data = await response.json()
      setStatus(data)
      setError(null)

      // If the status is still active, continue auto-refreshing
      if (
        data.status === 'pending' ||
        data.status === 'processing' ||
        data.status === 'receiving'
      ) {
        setAutoRefresh(true)
      } else {
        setAutoRefresh(false)
      }
    } catch (err) {
      logger.error('Error fetching import status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
      setAutoRefresh(false)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  // Initial fetch
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Set up auto-refresh if needed
  useEffect(() => {
    if (!autoRefresh) return

    const intervalId = setInterval(() => {
      fetchStatus()
    }, 2000) // Refresh every 2 seconds

    return () => clearInterval(intervalId)
  }, [autoRefresh, fetchStatus])

  // Manual refresh
  const refresh = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((prev) => !prev)
  }, [])

  return {
    status,
    loading,
    error,
    refresh,
    isAutoRefreshing: autoRefresh,
    toggleAutoRefresh,
  }
}
