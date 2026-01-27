import { createClient } from 'iom-sdk'
import { fetchClientConfig } from '@/constants'
import { logger } from '@/lib/logger'

let sdkClient: ReturnType<typeof createClient> | null = null

export async function getSdkClient() {
  if (sdkClient) return sdkClient

  const fetchedConfig = await fetchClientConfig()
  const isDev = fetchedConfig.nodeEnv !== 'production'

  sdkClient = createClient({
    auth: {
      baseUrl: fetchedConfig.authApiUrl,
      refreshBaseUrl: fetchedConfig.authRefreshApiUrl,
      timeout: 30000,
      retries: 3,
    },
    registry: {
      baseUrl: fetchedConfig.registryApiUrl,
      timeout: 30000,
      retries: 3,
    },
    node: {
      baseUrl: fetchedConfig.nodeApiUrl,
      timeout: 30000,
      retries: 3,
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
