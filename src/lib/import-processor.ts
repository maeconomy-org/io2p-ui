import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { untrackUserJob } from '@/lib/security-utils'
import { hsetWithTTL, REDIS_KEYS } from '@/lib/redis-utils'
import { API_BATCH_SIZE, API_REQUEST_DELAY } from '@/constants'

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
      // Job already processed or invalid - no logging needed
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
      const batch = allObjects.slice(i, i + batchSize)

      try {
        // Call the Node API bulk import endpoint directly
        const response = await fetch(`${nodeApiUrl}/api/Aggregate/Import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Unknown error' }))
          throw new Error(
            errorData.error || `API call failed with status ${response.status}`
          )
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
        logger.import(
          `Batch processing failed for job ${jobId}`,
          {
            jobId,
            batchIndex: Math.floor(i / batchSize),
            batchSize: batch.length,
            error: error.message,
          },
          'error'
        )

        // Update failed count
        await hsetWithTTL(REDIS_KEYS.job(jobId), {
          failed: failed.toString(),
          lastError: error.message,
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
      total: allObjects.length,
    })
  } catch (error: any) {
    logger.import(
      `Import job ${jobId} failed with error`,
      { jobId, error: error.message },
      'error'
    )

    // Mark job as failed
    await hsetWithTTL(REDIS_KEYS.job(jobId), {
      status: 'failed',
      error: error.message,
      failedAt: Date.now().toString(),
    })

    // Untrack the job for the user
    const jobData = await redis.hgetall(REDIS_KEYS.job(jobId))
    if (jobData.userUUID) {
      await untrackUserJob(jobData.userUUID, jobId)
    }
  }
}
