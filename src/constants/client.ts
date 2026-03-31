// Client-side constants that are fetched from /api/config at runtime
// This allows the same Docker image to work with different configurations

export interface ClientConfig {
  // Base URL for all services (e.g. https://maeconomy-dev.recheck.io)
  baseUrl: string
  // Optional mTLS certificate port (default: 553)
  certPort?: number

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
  baseUrl: '',

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

/**
 * Build runtime config from process.env (server-side only).
 * Single source of truth — used by both the /api/config route
 * and the inline <script> in layout.tsx.
 */
export function buildRuntimeConfig(): ClientConfig {
  return {
    baseUrl: process.env.BASE_URL || '',
    certPort: process.env.CERT_PORT
      ? parseInt(process.env.CERT_PORT)
      : undefined,
    sentryDsn: process.env.SENTRY_DSN || '',
    sentryEnabled: process.env.SENTRY_ENABLED || 'false',
    sentryRelease: process.env.SENTRY_RELEASE || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    emailLoginEnabled: process.env.EMAIL_LOGIN_ENABLED || 'false',
    appName: process.env.APP_NAME || 'Internet of Materials',
    appDescription: process.env.APP_DESCRIPTION || 'Material Management System',
    appAcronym: process.env.APP_ACRONYM || 'IoM',
    contactUrl: process.env.CONTACT_URL || 'https://example.com/contact',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@maeconomy.org',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100'),
    maxImportPayloadMB: parseInt(process.env.MAX_IMPORT_PAYLOAD_MB || '100'),
    maxObjectsPerImport: parseInt(
      process.env.MAX_OBJECTS_PER_IMPORT || '50000'
    ),
  }
}

/**
 * Sanitize a JSON string for safe embedding inside a <script> tag.
 * Prevents XSS via env vars containing </script> or <!-- sequences.
 */
function sanitizeForInlineScript(json: string): string {
  return json.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
}

/**
 * Build a safe inline script that sets window.__IOM_CONFIG__.
 * Sanitizes the output to prevent script-tag breakout from env vars.
 */
export function buildInlineConfigScript(): string {
  const config = buildRuntimeConfig()
  const safeJson = sanitizeForInlineScript(JSON.stringify(config))
  return `window.__IOM_CONFIG__=${safeJson};`
}

const CONFIG_CACHE_KEY = 'iom-client-config'
const CONFIG_CACHE_VERSION = 'v1' // Increment to invalidate cache

// Get cached config — checks inline <script> first, then localStorage
export function getCachedConfig(): ClientConfig | null {
  if (typeof window === 'undefined') return null

  // Prefer server-injected inline config (zero network requests)
  const inlineConfig = (window as any).__IOM_CONFIG__ as
    | ClientConfig
    | undefined
  if (inlineConfig && inlineConfig.baseUrl) {
    return inlineConfig
  }

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
