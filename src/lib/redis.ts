import { Redis } from 'ioredis'
import { logger } from './logger'

// Lazy-loaded Redis client singleton
// Only connects when getRedis() is called, not at module load time
// This prevents connection attempts during Next.js build/SSG

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    redis = new Redis(redisUrl, {
      // Connection settings
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Don't connect until first command
      connectTimeout: 10000, // 10s connection timeout
      commandTimeout: 5000, // 5s command timeout

      // Retry strategy with exponential backoff
      retryStrategy: (times) => {
        if (times > 10) {
          // Stop retrying after 10 attempts
          logger.error('Redis: Max retries reached, giving up')
          return null
        }
        const delay = Math.min(times * 100, 3000)
        return delay
      },

      // Reconnect on error
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        return targetErrors.some((e) => err.message.includes(e))
      },

      // Enable offline queue (commands wait for reconnection)
      enableOfflineQueue: true,

      // Keep alive to prevent connection drops
      keepAlive: 30000, // 30s
    })

    // The record's own `time` field covers timestamps; the logger serializer
    // owns error shape and redaction.
    const safeUrl = redisUrl.replace(/\/\/.*@/, '//***@') // Hide credentials

    redis.on('error', (error) => {
      logger.error('Redis connection error', { err: error, redisUrl: safeUrl })
    })

    redis.on('connect', () => {
      logger.info('Redis connected successfully', { redisUrl: safeUrl })
    })

    redis.on('ready', () => {
      logger.info('Redis ready and accepting commands', { redisUrl: safeUrl })
    })

    redis.on('reconnecting', (delay: number) => {
      logger.warn('Redis reconnecting', { delay })
    })

    redis.on('close', () => {
      logger.warn('Redis connection closed')
    })
  }

  return redis
}

// Test Redis connection and log status
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedis()
    await redis.ping()
    logger.info('Redis connection test successful', { status: 'connected' })
    return true
  } catch (error) {
    logger.error('Redis connection test failed', {
      err: error,
      status: 'failed',
    })
    return false
  }
}

// Graceful shutdown helper
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    logger.info('Redis connection closed gracefully')
  }
}
