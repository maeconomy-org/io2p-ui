import { Redis } from 'ioredis'

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
          console.error('Redis: Max retries reached, giving up')
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

    redis.on('error', (error) => {
      console.error('Redis connection error:', error.message)
    })

    redis.on('connect', () => {
      console.log('Redis connected')
    })

    redis.on('ready', () => {
      console.log('Redis ready')
    })
  }

  return redis
}

// Graceful shutdown helper
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
