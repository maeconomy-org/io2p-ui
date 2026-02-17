import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { untrackUserJob } from '@/lib/security-utils'
import { hsetWithTTL, REDIS_KEYS } from '@/lib/redis-utils'
import { API_BATCH_SIZE, API_REQUEST_DELAY } from '@/constants'

export async function processImportJob(jobId: string) {
  const redis = getRedis()

  try {
    // Test Redis connection at start of job processing
    await redis.ping()
    logger.import('Redis connection verified for import job processing', {
      jobId,
      timestamp: new Date().toISOString(),
    })

    // Get job metadata
    const jobData = await redis.hgetall(REDIS_KEYS.job(jobId))

    if (
      !jobData ||
      jobData.status === 'completed' ||
      jobData.status === 'failed' ||
      jobData.status === 'cancelled'
    ) {
      // Job already processed, cancelled, or invalid - no logging needed
      return
    }

    const totalChunks = parseInt(jobData.totalChunks || '0')
    let processed = parseInt(jobData.processed || '0')
    let failed = parseInt(jobData.failed || '0')
    const jwtToken = jobData.jwtToken

    if (!jwtToken) {
      logger.import('Missing JWT token for job', { jobId }, 'error')
      await hsetWithTTL(REDIS_KEYS.job(jobId), {
        status: 'failed',
        error: 'Missing JWT token for authentication',
      })
      return
    }

    // Get Node API URL from environment
    const nodeApiUrl = process.env.NODE_API_URL

    if (!nodeApiUrl) {
      logger.import('Node API URL not configured', { jobId }, 'error')
      await hsetWithTTL(REDIS_KEYS.job(jobId), {
        status: 'failed',
        error: 'Node API URL not configured',
      })
      return
    }

    // Log API configuration for debugging
    logger.import('Node API configuration', {
      jobId,
      nodeApiUrl: nodeApiUrl.replace(/\/\/.*@/, '//***@'), // Hide credentials if any
      endpoint: `${nodeApiUrl}/api/Aggregate/Import`,
      hasJwtToken: !!jwtToken,
      jwtTokenLength: jwtToken?.length || 0,
    })

    // Use constants for configuration
    const requestDelay = API_REQUEST_DELAY
    const batchSize = API_BATCH_SIZE

    // Collect all objects from all chunks to process them in batches
    const allObjects = []

    // Get objects from all chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkKey = REDIS_KEYS.chunk(jobId, chunkIndex)
      const chunkData = await redis.get(chunkKey)

      if (chunkData) {
        allObjects.push(...JSON.parse(chunkData))
        // Delete chunk after reading to free up memory
        await redis.del(chunkKey)
      } else {
        logger.import(
          `Missing chunk data for job ${jobId}, chunk ${chunkIndex}`,
          { jobId, chunkIndex },
          'warn'
        )
        // Mark job as failed if a chunk is missing
        await hsetWithTTL(REDIS_KEYS.job(jobId), {
          status: 'failed',
          error: `Missing chunk data for chunk ${chunkIndex}`,
        })
        return
      }
    }

    logger.import(`Processing ${allObjects.length} objects for job ${jobId}`, {
      jobId,
      totalObjects: allObjects.length,
    })

    // Process objects in batches by calling the Node API directly
    for (let i = 0; i < allObjects.length; i += batchSize) {
      // Check if job has been cancelled before processing next batch
      const currentJobData = await redis.hgetall(REDIS_KEYS.job(jobId))
      if (currentJobData.status === 'cancelled') {
        logger.import(`Job cancelled during processing`, {
          jobId,
          processed,
          remaining: allObjects.length - i,
        })
        return
      }

      const batch = allObjects.slice(i, i + batchSize)

      try {
        // Call the Node API bulk import endpoint directly
        logger.import(
          `Calling Node API for batch ${Math.floor(i / batchSize) + 1}`,
          {
            jobId,
            nodeApiUrl,
            batchSize: batch.length,
            endpoint: `${nodeApiUrl}/api/Aggregate/Import`,
          }
        )

        const response = await fetch(`${nodeApiUrl}/api/Aggregate/Import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(batch),
        })

        logger.import(`Node API response received`, {
          jobId,
          batchIndex: Math.floor(i / batchSize),
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        })

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }))

          const apiError = new Error(
            errorData.error || `API call failed with status ${response.status}`
          )

          // Add detailed API error context
          logger.import(
            `Node API call failed`,
            {
              jobId,
              batchIndex: Math.floor(i / batchSize),
              nodeApiUrl,
              endpoint: `${nodeApiUrl}/api/Aggregate/Import`,
              httpStatus: response.status,
              statusText: response.statusText,
              responseHeaders: Object.fromEntries(response.headers.entries()),
              errorData,
              requestHeaders: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer [REDACTED]',
              },
            },
            'error'
          )

          throw apiError
        }

        // Update progress
        processed += batch.length
        await hsetWithTTL(REDIS_KEYS.job(jobId), {
          processed: processed.toString(),
          lastProcessedAt: Date.now().toString(),
        })

        logger.import(
          `Processed batch ${Math.floor(i / batchSize) + 1} for job ${jobId}`,
          {
            jobId,
            batchSize: batch.length,
            processed,
            total: allObjects.length,
          }
        )

        // Add delay between batches to avoid overwhelming the API
        if (i + batchSize < allObjects.length && requestDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, requestDelay))
        }
      } catch (error: any) {
        failed += batch.length

        // Enhanced error logging with detailed context for Sentry
        const errorContext = {
          jobId,
          batchIndex: Math.floor(i / batchSize),
          batchSize: batch.length,
          batchStartIndex: i,
          batchEndIndex: i + batch.length - 1,
          totalObjects: allObjects.length,
          processed,
          failed,
          nodeApiUrl,
          error: error.message,
          errorStack: error.stack,
          httpStatus: error.status || 'unknown',
          timestamp: new Date().toISOString(),
          // Network-specific error details
          errorCode: error.code || 'unknown',
          errorType: error.constructor.name || 'unknown',
          networkError: error.cause?.message || 'unknown',
          // Add sample of failed objects for debugging (first 3 objects)
          sampleObjects: batch.slice(0, 3).map((obj) => ({
            id: obj.id || 'no-id',
            type: obj.type || 'unknown',
            hasRequiredFields: !!(obj.id && obj.type),
          })),
        }

        logger.import(
          `Batch processing failed for job ${jobId}`,
          errorContext,
          'error'
        )

        // Update failed count with more detailed error info
        await hsetWithTTL(REDIS_KEYS.job(jobId), {
          failed: failed.toString(),
          lastError: error.message,
          lastErrorTimestamp: Date.now().toString(),
          lastErrorBatch: Math.floor(i / batchSize).toString(),
        })

        // Continue processing other batches even if one fails
        continue
      }
    }

    // Mark job as completed or partially failed
    const finalStatus = failed > 0 ? 'completed_with_errors' : 'completed'
    await hsetWithTTL(REDIS_KEYS.job(jobId), {
      status: finalStatus,
      processed: processed.toString(),
      failed: failed.toString(),
      completedAt: Date.now().toString(),
    })

    // Untrack the job for the user
    if (jobData.userUUID) {
      await untrackUserJob(jobData.userUUID, jobId)
    }

    logger.import(`Import job ${jobId} completed`, {
      jobId,
      status: finalStatus,
      processed,
      failed,
      totalObjects: allObjects.length,
      completedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    // Enhanced error logging for job-level failures
    const jobErrorContext = {
      jobId,
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
      redisConnected: 'unknown',
      nodeApiUrl: process.env.NODE_API_URL ? 'configured' : 'missing',
      jobPhase: 'unknown', // Will be updated based on where the error occurred
    }

    // Try to determine what phase failed
    if (
      error.message.includes('Redis') ||
      error.message.includes('ECONNREFUSED')
    ) {
      jobErrorContext.jobPhase = 'redis_connection'
    } else if (
      error.message.includes('JWT') ||
      error.message.includes('token')
    ) {
      jobErrorContext.jobPhase = 'authentication'
    } else if (
      error.message.includes('API') ||
      error.message.includes('fetch')
    ) {
      jobErrorContext.jobPhase = 'api_communication'
    } else if (error.message.includes('chunk')) {
      jobErrorContext.jobPhase = 'data_retrieval'
    } else {
      jobErrorContext.jobPhase = 'general_processing'
    }

    logger.import(`Import job ${jobId} failed`, jobErrorContext, 'error')

    // Try to update job status to failed, but don't fail if Redis is down
    try {
      await hsetWithTTL(REDIS_KEYS.job(jobId), {
        status: 'failed',
        error: error.message,
        failedAt: Date.now().toString(),
        errorPhase: jobErrorContext.jobPhase,
      })
    } catch (redisError) {
      logger.import(
        'Failed to update job status in Redis',
        {
          jobId,
          originalError: error.message,
          redisError:
            redisError instanceof Error
              ? redisError.message
              : 'Unknown Redis error',
          timestamp: new Date().toISOString(),
        },
        'error'
      )
    }
  }
}
