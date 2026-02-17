// Client-side constants that are fetched from /api/config at runtime
// This allows the same Docker image to work with different configurations

export interface ClientConfig {
  // API endpoints - New service-based URLs
  authApiUrl: string
  authRefreshApiUrl: string
  registryApiUrl: string
  nodeApiUrl: string

  // Sentry config
  sentryDsn: string
  sentryEnabled: string
  sentryRelease: string

  // Environment
  nodeEnv: string
  emailLoginEnabled: string

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
}

// Default values (fallback if config API fails)
export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  authApiUrl: '',
  authRefreshApiUrl: '',
  registryApiUrl: '',
  nodeApiUrl: '',
  sentryDsn: '',
  sentryEnabled: 'false',
  sentryRelease: '',
  nodeEnv: 'development',
  emailLoginEnabled: 'false',
  appName: 'Internet of Materials',
  appDescription: 'Material Management System',
  appAcronym: 'IoM',
  contactUrl: 'https://example.com/contact',
  supportEmail: 'support@internetofmaterials.com',
  maxFileSizeMB: 100,
  maxImportPayloadMB: 100,
  maxObjectsPerImport: 50000,
}

const CONFIG_CACHE_KEY = 'iom-client-config'
const CONFIG_CACHE_VERSION = 'v1' // Increment to invalidate cache

// Get cached config from localStorage
export function getCachedConfig(): ClientConfig | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY)
    if (!cached) return null

    const { version, config, timestamp } = JSON.parse(cached)

    // Invalidate cache after 24 hours or version mismatch
    const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000
    if (isExpired || version !== CONFIG_CACHE_VERSION) {
      localStorage.removeItem(CONFIG_CACHE_KEY)
      return null
    }

    return config
  } catch {
    return null
  }
}

// Save config to localStorage
function setCachedConfig(config: ClientConfig): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(
      CONFIG_CACHE_KEY,
      JSON.stringify({
        version: CONFIG_CACHE_VERSION,
        config,
        timestamp: Date.now(),
      })
    )
  } catch (error) {
    console.warn('Failed to cache config:', error)
  }
}

// Fetch client config from API with caching
export async function fetchClientConfig(
  useCache = true
): Promise<ClientConfig> {
  // Try cache first for instant load
  if (useCache) {
    const cached = getCachedConfig()
    if (cached) {
      // Return cached config immediately
      // Refresh in background (fire and forget)
      fetch('/api/config')
        .then((res) => res.json())
        .then((freshConfig) => setCachedConfig(freshConfig))
        .catch(() => {}) // Silently fail background refresh

      return cached
    }
  }

  // No cache or cache disabled - fetch fresh
  try {
    const response = await fetch('/api/config')
    if (!response.ok) {
      throw new Error(`Config API failed: ${response.status}`)
    }
    const config = await response.json()
    setCachedConfig(config)
    return config
  } catch (error) {
    console.warn('Failed to fetch client config, using defaults:', error)
    return DEFAULT_CLIENT_CONFIG
  }
}
