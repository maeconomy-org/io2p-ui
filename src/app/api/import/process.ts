import redis from '@/lib/redis'
import {
  createCertificateAgent,
  getCertificateInfo,
} from '@/lib/certificate-utils'
import axios from 'axios'

export async function processImportJob(jobId: string) {
  try {
    // Get job metadata
    const jobData = await redis.hgetall(`import:${jobId}`)

    if (
      !jobData ||
      jobData.status === 'completed' ||
      jobData.status === 'failed'
    ) {
      console.log(`Job ${jobId} already ${jobData?.status || 'does not exist'}`)
      return
    }

    const totalChunks = parseInt(jobData.totalChunks || '0')
    let processed = parseInt(jobData.processed || '0')
    let failed = parseInt(jobData.failed || '0')

    // Get the request delay from environment or use default (100ms)
    const requestDelay = parseInt(process.env.API_REQUEST_DELAY || '100')

    // Get batch size from environment or use default (50)
    const batchSize = parseInt(process.env.API_BATCH_SIZE || '50')

    // Determine certificate verification behavior
    const shouldVerifyCerts = process.env.VERIFY_CERTIFICATES === 'true'

    // Set up HTTPS agent with client certificates using utility
    const httpsAgent = createCertificateAgent({
      password: process.env.CERTIFICATE_PASSWORD, // Get password from environment variables
      rejectUnauthorized: shouldVerifyCerts, // Controlled by environment
      fallbackToInsecure: true,
    })

    // Test certificate availability
    const certInfo = getCertificateInfo()
    if (!certInfo) {
      console.warn('No certificate found - using fallback agent')
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
      const chunkKey = `import:${jobId}:chunk:${chunkIndex}`
      const chunkData = await redis.get(chunkKey)

      if (!chunkData) {
        console.warn(`Chunk ${chunkIndex} not found for job ${jobId}`)
        continue
      }

      const chunkObjects = JSON.parse(chunkData)
      allObjects.push(...chunkObjects)
    }

    console.log(
      `Job ${jobId}: Processing ${allObjects.length} objects in batches of ${batchSize}`
    )

    // Get user UUID from job metadata
    const userUUID = jobData.userUUID

    if (!userUUID) {
      throw new Error('User UUID not found in job metadata')
    }

    // Process objects in batches
    for (let i = 0; i < allObjects.length; i += batchSize) {
      const batch = allObjects.slice(i, i + batchSize)

      try {
        // Wrap data with user info as required by the new API structure
        const payload = {
          aggregateEntityList: batch,
          user: {
            userUUID,
          },
        }

        // Send batch to Java backend API using axios
        const response = await axiosInstance.post(
          `${process.env.BASE_API_URL}/api/Aggregate/Import`,
          payload
        )

        console.log(
          `Batch ${Math.floor(i / batchSize) + 1} response:`,
          response.status
        )

        if (response.status < 200 || response.status >= 300) {
          throw new Error(`API responded with status ${response.status}`)
        }

        // Increment processed count by batch size
        processed += batch.length

        // Update progress after each batch
        await redis.hset(`import:${jobId}`, {
          processed: processed.toString(),
        })

        console.log(
          `Processed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} objects`
        )
      } catch (error) {
        console.error(
          `Error processing batch ${Math.floor(i / batchSize) + 1}:`,
          error
        )

        let shouldMarkAsFailed = true
        let errorMessage = 'Unknown error'

        // Check for different types of errors
        if (axios.isAxiosError(error)) {
          errorMessage =
            error.response?.data?.message || error.message || 'Unknown error'

          if (
            error.code === 'ECONNABORTED' &&
            error.message.includes('timeout')
          ) {
            console.warn(
              `⚠️  Batch ${Math.floor(i / batchSize) + 1} timed out - objects may have been created on server despite timeout`
            )
            console.warn(
              '⚠️  Consider checking the server or increasing timeout if this happens frequently'
            )
            // For timeouts, we'll still mark as failed but note it might have succeeded
          } else if (
            errorMessage.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
            errorMessage.includes('certificate')
          ) {
            console.error(
              'Certificate error - check certificate and private key files'
            )
          }

          console.error('Error details:', {
            message: errorMessage,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
          })
        } else if (error instanceof Error) {
          console.error('Non-HTTP error:', error.message)
          errorMessage = error.message
        } else {
          console.error('Unknown error type:', error)
          errorMessage = String(error)
        }

        // Record failure for the entire batch (but note timeout caveat above)
        if (shouldMarkAsFailed) {
          failed += batch.length
          await redis.hset(`import:${jobId}`, {
            failed: failed.toString(),
          })

          // Store failure details for each object in the batch
          for (let j = 0; j < batch.length; j++) {
            await redis.rpush(
              `import:${jobId}:failures`,
              JSON.stringify({
                index: i + j,
                object: batch[j],
                error: errorMessage,
                errorType: axios.isAxiosError(error)
                  ? error.code || 'HTTP_ERROR'
                  : 'UNKNOWN_ERROR',
                timestamp: Date.now(),
              })
            )
          }
        }
      }

      // Add a configurable delay between batch requests to avoid overwhelming the API
      if (i + batchSize < allObjects.length) {
        // Don't delay after the last batch
        await new Promise((resolve) => setTimeout(resolve, requestDelay))
      }
    }

    // Delete all chunks after processing to save memory
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      await redis.del(`import:${jobId}:chunk:${chunkIndex}`)
    }

    // Mark job as completed
    await redis.hset(`import:${jobId}`, {
      status: 'completed',
      completedAt: Date.now().toString(),
      processed: processed.toString(),
      failed: failed.toString(),
    })

    console.log(
      `Import job ${jobId} completed: ${processed} processed, ${failed} failed`
    )
  } catch (error) {
    console.error(`Error processing import job ${jobId}:`, error)

    // Mark job as failed
    await redis.hset(`import:${jobId}`, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      failedAt: Date.now().toString(),
    })

    throw error
  }
}
