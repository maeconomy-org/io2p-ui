import { createClient, type Client, type SDKConfig } from 'iom-sdk'
import type { ClientConfig } from '@/constants'
import { logger } from '@/lib/logger'

let sdkClient: Client | null = null

function buildServiceOverrides(config: ClientConfig): SDKConfig['services'] {
  const hasOverrides =
    config.authBaseUrl ||
    config.registryBaseUrl ||
    config.nodeBaseUrl ||
    config.userBaseUrl ||
    config.fileStorageBaseUrl ||
    config.authTimeout ||
    config.registryTimeout ||
    config.nodeTimeout ||
    config.userTimeout ||
    config.fileStorageTimeout

  if (!hasOverrides) return undefined

  return {
    ...(config.authBaseUrl || config.authTimeout
      ? {
          auth: {
            ...(config.authBaseUrl && { baseUrl: config.authBaseUrl }),
            ...(config.authTimeout && { timeout: config.authTimeout }),
          },
        }
      : {}),
    ...(config.registryBaseUrl || config.registryTimeout
      ? {
          registry: {
            ...(config.registryBaseUrl && {
              baseUrl: config.registryBaseUrl,
            }),
            ...(config.registryTimeout && {
              timeout: config.registryTimeout,
            }),
          },
        }
      : {}),
    ...(config.nodeBaseUrl || config.nodeTimeout
      ? {
          node: {
            ...(config.nodeBaseUrl && { baseUrl: config.nodeBaseUrl }),
            ...(config.nodeTimeout && { timeout: config.nodeTimeout }),
          },
        }
      : {}),
    ...(config.userBaseUrl || config.userTimeout
      ? {
          user: {
            ...(config.userBaseUrl && { baseUrl: config.userBaseUrl }),
            ...(config.userTimeout && { timeout: config.userTimeout }),
          },
        }
      : {}),
    ...(config.fileStorageBaseUrl || config.fileStorageTimeout
      ? {
          fileStorage: {
            ...(config.fileStorageBaseUrl && {
              baseUrl: config.fileStorageBaseUrl,
            }),
            ...(config.fileStorageTimeout && {
              timeout: config.fileStorageTimeout,
            }),
          },
        }
      : {}),
  }
}

export function getSdkClient(config: ClientConfig): Client {
  if (sdkClient) return sdkClient

  sdkClient = createClient({
    baseUrl: config.baseUrl,
    certPort: config.certPort,
    services: buildServiceOverrides(config),
    tokenStorage: 'localStorage',
    errorHandling: {
      debug: config.nodeEnv !== 'production',
      onAuthError: (err) => logger.error('SDK Auth Error:', err),
      onNetworkError: (err) => logger.error('SDK Network Error:', err),
      onServiceError: (err, service) =>
        logger.error(`SDK ${service} Error:`, err),
    },
  })

  return sdkClient
}
