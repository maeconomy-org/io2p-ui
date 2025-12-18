import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { useAuth } from '@/contexts'
import { IMPORT_CHUNK_SIZE, SIZE_THRESHOLD_MB } from '@/constants'

export interface ImportData {
  mappedData: any[]
  redirectOnComplete?: boolean
  statusPagePath?: string
}

export interface UseImportProcessOptions {
  onImportStarted?: (jobId: string) => void
  onImportError?: (error: Error) => void
  autoRedirect?: boolean
}

export interface UseImportProcessResult {
  isImporting: boolean
  importJobId: string | null
  startImport: (data: ImportData) => Promise<string | null>
  resetImport: () => void
}

// Config constants for chunking
const CHUNK_SIZE = IMPORT_CHUNK_SIZE

export function useImportProcess({
  onImportStarted,
  onImportError,
  autoRedirect = true,
}: UseImportProcessOptions = {}): UseImportProcessResult {
  const router = useRouter()
  const { userUUID } = useAuth()
  const [isImporting, setIsImporting] = useState(false)
  const [importJobId, setImportJobId] = useState<string | null>(null)

  // Function to start the import
  const startImport = useCallback(
    async ({
      mappedData,
      redirectOnComplete = autoRedirect,
      statusPagePath = '/import-status',
    }: ImportData) => {
      if (!mappedData || mappedData.length === 0) {
        toast.error('No data to import')
        return null
      }

      // Check if we have too many objects to import
      if (mappedData.length > 5000) {
        toast.warning(
          `You're about to import ${mappedData.length} objects. This might take some time.`
        )
      }

      setIsImporting(true)

      try {
        // Estimate data size to decide on chunking strategy
        const sampleSize = JSON.stringify(mappedData.slice(0, 10)).length / 10
        const estimatedDataSizeMB =
          (sampleSize * mappedData.length) / (1024 * 1024)

        // Always use chunking for large datasets
        const shouldUseChunking =
          estimatedDataSizeMB > SIZE_THRESHOLD_MB || mappedData.length > 1000

        let jobId: string | null = null

        if (shouldUseChunking) {
          toast.info(
            `Large dataset detected (estimated ${estimatedDataSizeMB.toFixed(2)}MB). Using optimized upload.`
          )
          jobId = await handleChunkedUpload(mappedData)
        } else {
          // Standard upload for smaller datasets
          if (!userUUID) {
            throw new Error('User UUID is required for import')
          }

          // Wrap data with user info as required by the new API structure
          const payload = {
            aggregateEntityList: mappedData,
            user: {
              userUUID,
            },
          }

          const response = await fetch('/api/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            const errorData = await response.json()

            // Handle rate limiting with user-friendly messages
            if (response.status === 429) {
              if (errorData.rateLimitInfo) {
                const resetMinutes = Math.ceil(
                  (errorData.rateLimitInfo.resetTime - Date.now()) / (1000 * 60)
                )
                throw new Error(
                  `Rate limit exceeded. Please wait ${resetMinutes} minutes before trying again. ` +
                    `You've made ${errorData.rateLimitInfo.current}/${errorData.rateLimitInfo.max} requests.`
                )
              }
              throw new Error(
                errorData.error || 'Too many requests. Please slow down.'
              )
            }

            // Handle payload size limits
            if (response.status === 413) {
              throw new Error(
                `Import too large: ${errorData.error}. ` +
                  `Consider breaking your data into smaller chunks.`
              )
            }

            throw new Error(errorData.error || 'Failed to start import')
          }

          const data = await response.json()
          jobId = data.jobId

          // Show warnings if any
          if (data.warning) {
            toast.warning(data.warning, {
              duration: 8000, // Show longer for warnings
            })
          }

          if (data.jobLimitWarning) {
            toast.warning(data.jobLimitWarning, {
              duration: 6000,
            })
          }
        }

        if (jobId) {
          setImportJobId(jobId)
          toast.success(`Import started with job ID: ${jobId}`)
          onImportStarted?.(jobId)

          // Redirect to status page if enabled
          if (redirectOnComplete) {
            toast.info('Redirecting to status page...')
            setTimeout(() => {
              router.push(`${statusPagePath}?jobId=${jobId}&redirect=true`)
            }, 1000)
          }
        }

        return jobId
      } catch (error) {
        logger.error('Import error:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        toast.error(`Import failed: ${errorMessage}`)
        onImportError?.(
          error instanceof Error ? error : new Error(errorMessage)
        )
        setIsImporting(false)
        return null
      }
    },
    [autoRedirect, router, onImportStarted, onImportError]
  )

  // Handle chunked upload for large payloads
  const handleChunkedUpload = useCallback(
    async (mappedData: any[]) => {
      try {
        if (!userUUID) {
          throw new Error('User UUID is required for chunked import')
        }

        // Split data into chunks
        const totalObjects = mappedData.length
        const totalChunks = Math.ceil(totalObjects / CHUNK_SIZE)

        toast.info(
          `Processing ${totalObjects} objects in ${totalChunks} chunks`
        )

        let jobId: string | null = null

        // Process each chunk
        for (let i = 0; i < totalObjects; i += CHUNK_SIZE) {
          const chunk = mappedData.slice(i, i + CHUNK_SIZE)
          const chunkIndex = Math.floor(i / CHUNK_SIZE)
          const chunkPercent = Math.round((chunkIndex / totalChunks) * 100)

          // Update progress toast
          toast.loading(
            `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)...`,
            {
              id: 'chunk-upload',
            }
          )

          // Send chunk to API with user info
          const chunkPayload = {
            aggregateEntityList: chunk,
            user: {
              userUUID,
            },
            total: totalObjects,
            chunkIndex,
            totalChunks,
            sessionId: jobId, // Only null for first chunk
          }

          const response: Response = await fetch('/api/import/chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunkPayload),
          })

          if (!response.ok) {
            const errorData = await response.json()

            // Handle rate limiting for chunks
            if (response.status === 429) {
              if (errorData.rateLimitInfo) {
                const resetMinutes = Math.ceil(
                  (errorData.rateLimitInfo.resetTime - Date.now()) / (1000 * 60)
                )
                throw new Error(
                  `Upload rate limit exceeded at chunk ${chunkIndex + 1}. ` +
                    `Please wait ${resetMinutes} minutes before retrying.`
                )
              }
              throw new Error(
                `Rate limit exceeded at chunk ${chunkIndex + 1}. Please slow down.`
              )
            }

            // Handle chunk size limits
            if (response.status === 413) {
              throw new Error(
                `Chunk ${chunkIndex + 1} is too large: ${errorData.error}`
              )
            }

            throw new Error(
              errorData.error || `Failed to upload chunk ${chunkIndex + 1}`
            )
          }

          const data: {
            jobId: string
            status: string
            message: string
            progress: string
            complete: boolean
          } = await response.json()

          // Store job ID from first chunk response
          if (chunkIndex === 0) {
            jobId = data.jobId
            setImportJobId(data.jobId)
          }

          // Update progress
          toast.success(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded`, {
            id: 'chunk-upload',
          })

          // If all chunks uploaded, show completion message
          if (data.complete || chunkIndex === totalChunks - 1) {
            toast.success(
              `All chunks uploaded (${totalObjects} objects), processing will start automatically`
            )
          }
        }

        return jobId
      } catch (error) {
        logger.error('Chunked upload error:', error)
        toast.error(
          `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        setIsImporting(false)
        return null
      }
    },
    [userUUID]
  )

  // Reset the import state
  const resetImport = useCallback(() => {
    setIsImporting(false)
    setImportJobId(null)
  }, [])

  return {
    isImporting,
    importJobId,
    startImport,
    resetImport,
  }
}
