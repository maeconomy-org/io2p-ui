import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { getCoreToken } from '@/lib/auth-client'
import { logger } from '@/lib/logger'
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

/**
 * Both upload paths are pure functions of their arguments — no component scope, no hooks. Declared
 * at module level so `startBulkImport` is not calling something defined below it: the compiler lint
 * rejects that, and the stale-closure risk it warns about is real once these are recreated per
 * render.
 */
async function handleStandardUpload(
  mappedData: unknown[],
  jwtToken: string
): Promise<string> {
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

async function handleChunkedUpload(
  mappedData: unknown[],
  jwtToken: string,
  t: (key: string, values?: Record<string, string | number>) => string
): Promise<string> {
  const totalObjects = mappedData.length
  const totalChunks = Math.ceil(totalObjects / API_CHUNK_SIZE)

  toast.info(
    t('import.toasts.processingChunks', {
      total: totalObjects,
      chunks: totalChunks,
    })
  )

  let jobId: string | null = null

  // Process each chunk
  for (let i = 0; i < totalObjects; i += API_CHUNK_SIZE) {
    const chunk = mappedData.slice(i, i + API_CHUNK_SIZE)
    const chunkIndex = Math.floor(i / API_CHUNK_SIZE)
    const chunkPercent = Math.round((chunkIndex / totalChunks) * 100)

    // Update progress toast
    toast.loading(
      t('import.toasts.uploadingChunk', {
        current: chunkIndex + 1,
        total: totalChunks,
        percent: chunkPercent,
      }),
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

  toast.success(t('import.toasts.allUploaded'), {
    id: 'chunk-upload',
    description: t('import.importJobIdLabel', { id: jobId ?? '' }),
  })

  return jobId!
}

export function useBulkImport({
  onImportStarted,
  onImportError,
  autoRedirect = true,
}: UseBulkImportOptions = {}): UseBulkImportResult {
  const router = useRouter()
  const [isImporting, setIsImporting] = useState(false)
  const t = useTranslations()

  const startBulkImport = useCallback(
    async (
      mappedData: unknown[]
    ): Promise<{ success: boolean; jobId?: string; error?: string }> => {
      if (isImporting) {
        return { success: false, error: 'Import already in progress' }
      }

      setIsImporting(true)

      try {
        // The core JWT, not the retired client's — the import routes verify the same token every
        // other `/api/*` call carries.
        const token = await getCoreToken()
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
            t('import.toasts.largeDataset', {
              size: estimatedDataSizeMB.toFixed(2),
            })
          )
          jobId = await handleChunkedUpload(mappedData, token, t)
        } else {
          // Standard upload for smaller datasets
          jobId = await handleStandardUpload(mappedData, token)
        }

        if (jobId) {
          onImportStarted?.(jobId)
          toast.success(t('import.toasts.jobStarted'), {
            description: t('import.importJobId', { id: jobId }),
          })

          if (autoRedirect) {
            // redirect=true lets the status page navigate to /objects once the
            // job reaches a completed state (see import-status/page.tsx).
            router.push(`/import-status?jobId=${jobId}&redirect=true`)
          }

          return { success: true, jobId }
        }

        return { success: false, error: 'Failed to start import job' }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown import error'
        logger.error('Bulk import failed:', { err: error })

        toast.error(t('import.toasts.failed'), {
          description: errorMessage,
        })

        onImportError?.('unknown', errorMessage)
        return { success: false, error: errorMessage }
      } finally {
        setIsImporting(false)
      }
    },
    [isImporting, onImportStarted, onImportError, autoRedirect, router, t]
  )

  return {
    isImporting,
    startBulkImport,
  }
}
