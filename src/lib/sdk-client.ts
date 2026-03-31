import { createClient } from 'iom-sdk'
import type { ClientConfig } from '@/constants'
import { logger } from '@/lib/logger'

let sdkClient: ReturnType<typeof createClient> | null = null

export function getSdkClient(config: ClientConfig) {
  if (sdkClient) return sdkClient

  const isDev = config.nodeEnv !== 'production'

  sdkClient = createClient({
    baseUrl: config.baseUrl,
    certPort: config.certPort,
    services: {
      auth: { timeout: 30000, retries: 3 },
      registry: { timeout: 30000, retries: 3 },
      node: { timeout: 30000, retries: 3 },
    },
    tokenStorage: 'localStorage',
    errorHandling: {
      debug: isDev,
      onAuthError: (err) => logger.error('SDK Auth Error:', err),
      onNetworkError: (err) => logger.error('SDK Network Error:', err),
      onServiceError: (err, service) =>
        logger.error(`SDK ${service} Error:`, err),
    },
  })

  return sdkClient
}
