// Client-side constants that are fetched from /api/config at runtime
// This allows the same Docker image to work with different configurations

export interface ClientConfig {
  // API endpoints
  baseApiUrl: string
  uuidApiUrl: string

  // Sentry config
  sentryDsn: string
  sentryEnabled: string
  sentryRelease: string

  // Environment
  nodeEnv: string

  // App information
  appName: string
  appDescription: string
  appAcronym: string
  contactUrl: string
  supportEmail: string

  // Import limits
  maxFileSizeMB: number
  maxImportPayloadMB: number
  maxObjectsPerImport: number

  // SDK logging config
  sdkDebugEnabled: boolean
  sdkLogLevel: string
  sdkLogToConsole: boolean
}

// Default values (fallback if config API fails)
export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  baseApiUrl: '',
  uuidApiUrl: '',
  sentryDsn: '',
  sentryEnabled: 'false',
  sentryRelease: '',
  nodeEnv: 'development',
  appName: 'Internet of Materials',
  appDescription: 'Material Management System',
  appAcronym: 'IoM',
  contactUrl: 'https://example.com/contact',
  supportEmail: 'support@internetofmaterials.com',
  maxFileSizeMB: 100,
  maxImportPayloadMB: 100, // Should match or be less than file size
  maxObjectsPerImport: 50000,
  sdkDebugEnabled: false,
  sdkLogLevel: 'info',
  sdkLogToConsole: true,
}

// Fetch client config from API
export async function fetchClientConfig(): Promise<ClientConfig> {
  try {
    const response = await fetch('/api/config')
    if (!response.ok) {
      throw new Error(`Config API failed: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    // Use console.warn here since logger might not be initialized yet during config fetch
    console.warn('Failed to fetch client config, using defaults:', error)
    return DEFAULT_CLIENT_CONFIG
  }
}
