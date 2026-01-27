import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useIomSdkClient } from '@/contexts'
import { logger } from '@/lib'
import { API_CHUNK_SIZE } from '@/constants'

interface UseBulkImportOptions {
  onImportStarted?: (jobId: string) => void
  onImportError?: (jobId: string, error: string) => void
  autoRedirect?: boolean
}

interface UseBulkImportResult {
  isImporting: boolean
  startBulkImport: (
    data: unknown[]
  ) => Promise<{ success: boolean; jobId?: string; error?: string }>
}

interface ChunkPayload {
  aggregateEntityList: unknown[]
  total: number
  chunkIndex: number
  totalChunks: number
  sessionId: string | null
}

interface ApiResponse {
  jobId: string
  error?: string
}

export function useBulkImport({
  onImportStarted,
  onImportError,
  autoRedirect = true,
}: UseBulkImportOptions = {}): UseBulkImportResult {
  const router = useRouter()
  const client = useIomSdkClient()
  const [isImporting, setIsImporting] = useState(false)

  const startBulkImport = useCallback(
    async (
      mappedData: unknown[]
    ): Promise<{ success: boolean; jobId?: string; error?: string }> => {
      if (isImporting) {
        return { success: false, error: 'Import already in progress' }
      }

      setIsImporting(true)

      try {
        // Get JWT token for API calls
        const token = client.getToken()
        if (!token) {
          throw new Error(
            'No authentication token available. Please login first.'
          )
        }

        // Estimate data size for chunked upload decision
        const estimatedDataSizeMB =
          JSON.stringify(mappedData).length / (1024 * 1024)

        let jobId: string

        if (estimatedDataSizeMB > 50) {
          // Use chunked upload for large datasets
          toast.info(
            `Large dataset detected (estimated ${estimatedDataSizeMB.toFixed(2)}MB). Using optimized upload.`
          )
          jobId = await handleChunkedUpload(mappedData, token)
        } else {
          // Standard upload for smaller datasets
          jobId = await handleStandardUpload(mappedData, token)
        }

        if (jobId) {
          onImportStarted?.(jobId)
          toast.success('Import job started successfully!', {
            description: `Job ID: ${jobId}`,
          })

          if (autoRedirect) {
            router.push(`/import-status?jobId=${jobId}`)
          }

          return { success: true, jobId }
        }

        return { success: false, error: 'Failed to start import job' }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown import error'
        logger.error('Bulk import failed:', error)

        toast.error('Import failed', {
          description: errorMessage,
        })

        onImportError?.('unknown', errorMessage)
        return { success: false, error: errorMessage }
      } finally {
        setIsImporting(false)
      }
    },
    [isImporting, client, onImportStarted, onImportError, autoRedirect, router]
  )

  const handleStandardUpload = async (
    mappedData: unknown[],
    jwtToken: string
  ): Promise<string> => {
    const payload = {
      aggregateEntityList: mappedData,
    }

    const response = await fetch('/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string }
      throw new Error(errorData.error || 'Failed to start import job')
    }

    const result = (await response.json()) as ApiResponse
    return result.jobId
  }

  const handleChunkedUpload = async (
    mappedData: unknown[],
    jwtToken: string
  ): Promise<string> => {
    const totalObjects = mappedData.length
    const totalChunks = Math.ceil(totalObjects / API_CHUNK_SIZE)

    toast.info(`Processing ${totalObjects} objects in ${totalChunks} chunks`)

    let jobId: string | null = null

    // Process each chunk
    for (let i = 0; i < totalObjects; i += API_CHUNK_SIZE) {
      const chunk = mappedData.slice(i, i + API_CHUNK_SIZE)
      const chunkIndex = Math.floor(i / API_CHUNK_SIZE)
      const chunkPercent = Math.round((chunkIndex / totalChunks) * 100)

      // Update progress toast
      toast.loading(
        `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)...`,
        {
          id: 'chunk-upload',
          description: `Objects: ${i + 1}-${Math.min(
            i + API_CHUNK_SIZE,
            totalObjects
          )}`,
        }
      )

      // Send chunk to API
      const chunkPayload: ChunkPayload = {
        aggregateEntityList: chunk,
        total: totalObjects,
        chunkIndex,
        totalChunks,
        sessionId: jobId, // Only null for first chunk
      }

      const response = await fetch('/api/import/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(chunkPayload),
      })

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string }
        throw new Error(
          errorData.error || `Failed to upload chunk ${chunkIndex + 1}`
        )
      }

      const result = (await response.json()) as ApiResponse
      if (!jobId) {
        jobId = result.jobId // Get jobId from the first chunk response
      }
    }

    toast.success('All chunks uploaded!', {
      id: 'chunk-upload',
      description: `Import job ID: ${jobId}`,
    })

    return jobId!
  }

  return {
    isImporting,
    startBulkImport,
  }
}
