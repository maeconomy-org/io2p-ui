import { getRedis } from '@/lib/redis'
import { hsetWithTTL, REDIS_KEYS } from '@/lib/redis-utils'
import { untrackUserJob } from '@/lib/security-utils'
import { logger } from '@/lib/logger'
import {
  createCertificateAgent,
  getCertificateInfo,
} from '@/lib/certificate-utils'
import {
  API_BATCH_SIZE,
  API_REQUEST_DELAY,
  PARALLEL_REQUESTS,
  REDIS_JOB_TTL_HOURS,
} from '@/constants'
import axios from 'axios'

export async function processImportJob(jobId: string) {
  const redis = getRedis()

  try {
    // Get job metadata
    const jobData = await redis.hgetall(REDIS_KEYS.job(jobId))

    if (
      !jobData ||
      jobData.status === 'completed' ||
      jobData.status === 'failed'
    ) {
      // Job already processed - no logging needed
      return
    }

    const totalChunks = parseInt(jobData.totalChunks || '0')
    let processed = parseInt(jobData.processed || '0')
    let failed = parseInt(jobData.failed || '0')

    // Use constants for configuration
    const requestDelay = API_REQUEST_DELAY
    const batchSize = API_BATCH_SIZE
    const parallelRequests = PARALLEL_REQUESTS

    // Set up HTTPS agent with client certificates using utility
    // TLS verification is now completely controlled by environment variables
    const httpsAgent = createCertificateAgent({
      password: process.env.CERTIFICATE_PASSWORD,
    })

    // Test certificate availability
    const certInfo = getCertificateInfo()
    if (!certInfo) {
      // Certificate fallback - expected in dev environments
    }

    // Create axios instance with certificate configuration
    const axiosInstance = axios.create({
      httpsAgent: httpsAgent,
      timeout: 120000, // Increase to 2 minutes for large batches
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Collect all objects first from all chunks to process them in batches
    const allObjects = []

    // Get objects from all chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      // Get chunk of objects
      const chunkKey = REDIS_KEYS.chunk(jobId, chunkIndex)
      const chunkData = await redis.get(chunkKey)

      if (!chunkData) {
        // Chunk missing - log error only
        continue
      }

      const chunkObjects = JSON.parse(chunkData)
      allObjects.push(...chunkObjects)
    }

    // Processing started - no logging needed for success case

    // Get user UUID from job metadata
    if (!jobData.userUUID) {
      throw new Error('User UUID not found in job metadata')
    }
    const userUUID = jobData.userUUID

    // Process objects in parallel batches for better performance
    await processObjectsInParallel(
      allObjects,
      userUUID,
      batchSize,
      parallelRequests,
      requestDelay,
      axiosInstance,
      jobId,
      redis,
      (processedCount, failedCount) => {
        processed = processedCount
        failed = failedCount
      }
    )

    // Delete all chunks after processing to save memory
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      await redis.del(REDIS_KEYS.chunk(jobId, chunkIndex))
    }

    // Mark job as completed with TTL
    await hsetWithTTL(REDIS_KEYS.job(jobId), {
      status: 'completed',
      completedAt: Date.now().toString(),
      processed: processed.toString(),
      failed: failed.toString(),
    })

    // Remove job from user tracking
    if (userUUID) {
      await untrackUserJob(userUUID, jobId)
    }

    // Log completion
    logger.import('import_completed', {
      jobId,
      userUUID,
      processed,
      failed,
      totalObjects: allObjects.length,
      duration: Date.now() - parseInt(jobData.createdAt || '0'),
    })

    // Job completed successfully - no logging needed
  } catch (error) {
    logger.import('Import job failed', { jobId }, 'error')

    // Mark job as failed with TTL
    await hsetWithTTL(REDIS_KEYS.job(jobId), {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      failedAt: Date.now().toString(),
    })

    // Remove job from user tracking
    const errorJobData = await redis.hgetall(REDIS_KEYS.job(jobId))
    const errorUserUUID = errorJobData.userUUID
    if (errorUserUUID) {
      await untrackUserJob(errorUserUUID, jobId)
    }

    // Log failure
    logger.import(
      'import_failed',
      {
        jobId,
        userUUID: errorUserUUID,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - parseInt(errorJobData.createdAt || '0'),
      },
      'error'
    )

    throw error
  }
}

/**
 * Process objects in parallel batches for improved performance
 */
async function processObjectsInParallel(
  allObjects: any[],
  userUUID: string,
  batchSize: number,
  parallelRequests: number,
  requestDelay: number,
  axiosInstance: any,
  jobId: string,
  redis: any,
  onProgress: (processed: number, failed: number) => void
): Promise<void> {
  let processed = 0
  let failed = 0
  const totalBatches = Math.ceil(allObjects.length / batchSize)

  logger.info('starting_parallel_processing', {
    jobId,
    totalObjects: allObjects.length,
    batchSize,
    parallelRequests,
    totalBatches,
  })

  // Use rolling window approach - start new batches as soon as previous ones complete
  let batchIndex = 0
  const runningPromises = new Set<Promise<void>>()

  // Helper function to process a single batch
  const processSingleBatch = async (
    batch: any[],
    batchNumber: number
  ): Promise<void> => {
    try {
      const result = await processBatch(
        batch,
        userUUID,
        batchNumber,
        axiosInstance,
        jobId,
        redis
      )

      processed += result.processedCount
      failed += result.failedCount

      logger.info('batch_completed', {
        jobId,
        batchNumber,
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        totalProcessed: processed,
        totalFailed: failed,
      })

      // Update progress immediately after each batch
      await redis.hset(REDIS_KEYS.job(jobId), {
        processed: processed.toString(),
        failed: failed.toString(),
      })

      onProgress(processed, failed)
    } catch (error) {
      const batchSize = batch.length
      failed += batchSize

      logger.error('batch_failed_completely', {
        jobId,
        batchNumber,
        batchSize,
        error: error instanceof Error ? error.message : String(error),
      })

      // Update failed count
      await redis.hset(REDIS_KEYS.job(jobId), {
        failed: failed.toString(),
      })

      onProgress(processed, failed)
    }
  }

  // Start initial batches up to parallelRequests limit
  while (
    batchIndex * batchSize < allObjects.length &&
    runningPromises.size < parallelRequests
  ) {
    const startIdx = batchIndex * batchSize
    const batch = allObjects.slice(startIdx, startIdx + batchSize)
    const batchNumber = batchIndex + 1

    const promise = processSingleBatch(batch, batchNumber)
    runningPromises.add(promise)

    // Remove promise when it completes
    promise.finally(() => {
      runningPromises.delete(promise)
    })

    batchIndex++

    // Small delay between starting batches to avoid overwhelming
    if (batchIndex * batchSize < allObjects.length) {
      await new Promise((resolve) => setTimeout(resolve, requestDelay))
    }
  }

  // Continue processing remaining batches as running ones complete
  while (
    batchIndex * batchSize < allObjects.length ||
    runningPromises.size > 0
  ) {
    if (
      batchIndex * batchSize < allObjects.length &&
      runningPromises.size < parallelRequests
    ) {
      // Start next batch
      const startIdx = batchIndex * batchSize
      const batch = allObjects.slice(startIdx, startIdx + batchSize)
      const batchNumber = batchIndex + 1

      const promise = processSingleBatch(batch, batchNumber)
      runningPromises.add(promise)

      promise.finally(() => {
        runningPromises.delete(promise)
      })

      batchIndex++

      // Small delay between starting batches
      await new Promise((resolve) => setTimeout(resolve, requestDelay))
    } else {
      // Wait for at least one batch to complete before checking again
      if (runningPromises.size > 0) {
        await Promise.race(runningPromises)
      }
    }
  }

  logger.info('parallel_processing_completed', {
    jobId,
    totalProcessed: processed,
    totalFailed: failed,
    totalBatches,
  })
}

/**
 * Process a single batch
 */
async function processBatch(
  batch: any[],
  userUUID: string,
  batchNumber: number,
  axiosInstance: any,
  jobId: string,
  redis: any
): Promise<{ processedCount: number; failedCount: number }> {
  try {
    const payload = {
      aggregateEntityList: batch,
      user: { userUUID },
    }

    const response = await axiosInstance.post(
      `${process.env.BASE_API_URL}/api/Aggregate/Import`,
      payload
    )

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`API responded with status ${response.status}`)
    }

    logger.debug('batch_success', {
      jobId,
      batchNumber,
      objectCount: batch.length,
      responseStatus: response.status,
    })

    return { processedCount: batch.length, failedCount: 0 }
  } catch (error) {
    logger.error('batch_processing_error', {
      jobId,
      batchNumber,
      objectCount: batch.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    let shouldMarkAsFailed = true
    let errorMessage = 'Unknown error'

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        // Timeout - request might have succeeded
        logger.warn('batch_timeout', {
          jobId,
          batchNumber,
          message: 'Request timed out - may have succeeded on server',
        })
        shouldMarkAsFailed = false
        errorMessage = 'Request timeout (may have succeeded)'
      } else if (error.response) {
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`
      } else if (error.request) {
        errorMessage = 'Network error: No response received'
      } else {
        errorMessage = error.message
      }
    } else {
      errorMessage = String(error)
    }

    if (shouldMarkAsFailed) {
      // Store failure details for each object in the batch
      const failureKey = REDIS_KEYS.failures(jobId)
      const failurePromises = batch.map((obj, index) =>
        redis.rpush(
          failureKey,
          JSON.stringify({
            batchNumber,
            index,
            object: obj,
            error: errorMessage,
            errorType: axios.isAxiosError(error)
              ? error.code || 'HTTP_ERROR'
              : 'UNKNOWN_ERROR',
            timestamp: Date.now(),
          })
        )
      )

      await Promise.all(failurePromises)

      // Set TTL on failure list to prevent indefinite storage (same as job TTL)
      await redis.expire(failureKey, REDIS_JOB_TTL_HOURS * 60 * 60)

      return { processedCount: 0, failedCount: batch.length }
    }

    return { processedCount: batch.length, failedCount: 0 }
  }
}
