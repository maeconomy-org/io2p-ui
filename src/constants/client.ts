// Client-side constants that are fetched from /api/config at runtime
// This allows the same Docker image to work with different configurations

export interface ClientConfig {
  // Base URL for all services (e.g. https://maeconomy-dev.recheck.io)
  baseUrl: string
  // Optional mTLS certificate port (default: 553)
  certPort?: number

  // io2p backend (new): storage-node origin consumed by io2p-client.
  // authBaseUrl (below) doubles as the better-auth issuer origin.
  coreBaseUrl?: string

  // Optional per-service URL overrides (when services live on different hosts)
  authBaseUrl?: string
  registryBaseUrl?: string
  nodeBaseUrl?: string
  userBaseUrl?: string
  fileStorageBaseUrl?: string

  // Optional per-service timeout overrides in ms (default: 30000)
  authTimeout?: number
  registryTimeout?: number
  nodeTimeout?: number
  userTimeout?: number
  fileStorageTimeout?: number

  // Max concurrent file uploads (file-level, not S3 part-level). Default: 6
  fileUploadConcurrency: number

  // Sentry config
  sentryDsn: string
  sentryEnabled: string
  sentryRelease: string

  // Logging (browser reads these via __IOM_CONFIG__ — process.env compiles
  // away client-side, so an env read in browser code is always undefined)
  // logLevel: browser console emit gate outside production ('' = default)
  logLevel: string
  // logShipLevel: minimum level shipped to /api/telemetry ('' = default)
  logShipLevel: string

  // Environment
  nodeEnv: string
  emailLoginEnabled: string
  // Comma-separated better-auth social provider ids the issuer has credentials
  // for. A provider listed here without matching credentials on io2p-auth
  // renders a button that dead-ends in a 400.
  socialProviders: string

  // App information
  appName: string
  appDescription: string
  appAcronym: string
  contactUrl: string
  supportEmail: string

  // Import limits
  maxImportFileSizeMB: number
  maxImportPayloadMB: number
  maxObjectsPerImport: number

  // Attachment upload cap (S3-streamed)
  maxAttachmentSizeMB: number
}

// Default values (fallback if config API fails)
export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  baseUrl: '',

  sentryDsn: '',
  sentryEnabled: 'false',
  sentryRelease: '',
  logLevel: '',
  logShipLevel: '',
  nodeEnv: 'development',
  emailLoginEnabled: 'true',
  socialProviders: 'google,microsoft',
  appName: 'Internet of Materials',
  appDescription: 'Material Management System',
  appAcronym: 'IoM',
  contactUrl: 'https://example.com/contact',
  supportEmail: 'support@internetofmaterials.com',
  maxImportFileSizeMB: 100,
  maxImportPayloadMB: 100,
  maxObjectsPerImport: 50000,
  maxAttachmentSizeMB: 1024,
  fileUploadConcurrency: 6,
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
    coreBaseUrl:
      process.env.CORE_BASE_URL || process.env.NODE_BASE_URL || undefined,
    authBaseUrl: process.env.AUTH_BASE_URL || undefined,
    registryBaseUrl: process.env.REGISTRY_BASE_URL || undefined,
    nodeBaseUrl: process.env.NODE_BASE_URL || undefined,
    userBaseUrl: process.env.USER_BASE_URL || undefined,
    fileStorageBaseUrl:
      process.env.FILE_STORAGE_BASE_URL ||
      process.env.FILE_STORAGE_API_URL ||
      undefined,
    authTimeout: process.env.AUTH_TIMEOUT
      ? parseInt(process.env.AUTH_TIMEOUT)
      : undefined,
    registryTimeout: process.env.REGISTRY_TIMEOUT
      ? parseInt(process.env.REGISTRY_TIMEOUT)
      : undefined,
    nodeTimeout: process.env.NODE_TIMEOUT
      ? parseInt(process.env.NODE_TIMEOUT)
      : undefined,
    userTimeout: process.env.USER_TIMEOUT
      ? parseInt(process.env.USER_TIMEOUT)
      : undefined,
    fileStorageTimeout: process.env.FILE_STORAGE_TIMEOUT
      ? parseInt(process.env.FILE_STORAGE_TIMEOUT)
      : undefined,
    fileUploadConcurrency: parseInt(process.env.FILE_UPLOAD_CONCURRENCY || '6'),
    sentryDsn: process.env.SENTRY_DSN || '',
    sentryEnabled: process.env.SENTRY_ENABLED || 'false',
    sentryRelease: process.env.SENTRY_RELEASE || process.env.APP_VERSION || '',
    logLevel: process.env.LOG_LEVEL || '',
    logShipLevel: process.env.LOG_SHIP_LEVEL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    emailLoginEnabled: process.env.EMAIL_LOGIN_ENABLED || 'true',
    socialProviders:
      process.env.SOCIAL_PROVIDERS ?? DEFAULT_CLIENT_CONFIG.socialProviders,
    appName: process.env.APP_NAME || 'Internet of Materials',
    appDescription: process.env.APP_DESCRIPTION || 'Material Management System',
    appAcronym: process.env.APP_ACRONYM || 'IoM',
    contactUrl: process.env.CONTACT_URL || 'https://example.com/contact',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@maeconomy.org',
    maxImportFileSizeMB: parseInt(process.env.MAX_IMPORT_FILE_SIZE_MB || '100'),
    maxImportPayloadMB: parseInt(process.env.MAX_IMPORT_PAYLOAD_MB || '100'),
    maxObjectsPerImport: parseInt(
      process.env.MAX_OBJECTS_PER_IMPORT || '50000'
    ),
    maxAttachmentSizeMB: parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '1024'),
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
export function buildInlineConfigScript(config = buildRuntimeConfig()): string {
  const safeJson = sanitizeForInlineScript(JSON.stringify(config))
  return `window.__IOM_CONFIG__=${safeJson};`
}

const CONFIG_CACHE_KEY = 'iom-client-config'
const CONFIG_CACHE_VERSION = 'v1' // Increment to invalidate cache

// Get cached config — checks inline <script> first, then localStorage
export function getCachedConfig(): ClientConfig | null {
  if (typeof window === 'undefined') return null

  // Prefer server-injected inline config (zero network requests). Gate on
  // the OBJECT being present, not on any one field — a deployment without
  // BASE_URL must not lose every other inline value (logLevel, sentryDsn…)
  // to the stale-localStorage path.
  const inlineConfig = (window as any).__IOM_CONFIG__ as
    | ClientConfig
    | undefined
  if (inlineConfig && typeof inlineConfig === 'object') {
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
