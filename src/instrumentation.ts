import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')

    // Test Redis connection on server startup (with delay for Docker)
    try {
      // Add delay in Docker environments to allow Redis to fully start
      if (process.env.NODE_ENV === 'production') {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      const { testRedisConnection } = await import('@/lib/redis')
      const connected = await testRedisConnection()

      if (!connected) {
        console.warn(
          '[STARTUP] Redis connection failed - import functionality may be limited'
        )
      }
    } catch (error) {
      console.error('[STARTUP] Failed to test Redis connection:', error)
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
