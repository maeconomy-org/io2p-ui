// App information - use fetchClientConfig() for client-side access
// These are only for server-side usage
export const APP_NAME = process.env.APP_NAME || 'Internet of Materials'
export const APP_DESCRIPTION =
  process.env.APP_DESCRIPTION || 'Material Management System'
export const APP_ACRONYM = process.env.APP_ACRONYM || 'IoM'

// Auth-related
export const AUTH_SESSION_KEY = 'auth_status'
export const AUTH_SESSION_TIMEOUT = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

// Navigation
export const NAV_ITEMS = [
  { name: 'Objects', path: '/objects' },
  { name: 'I/O Processes', path: '/processes' },
  // { name: 'Groups', path: '/groups' },
  { name: 'Models', path: '/models' },
  { name: 'Import', path: '/import' },
  // { name: 'API Documentation', path: '#', isDisabled: true },
  // { name: 'Export Data', path: '#', isDisabled: true },
]

// Footer links
export const FOOTER_LINKS = [{ name: 'Help', path: '/help' }]

// Contact information - use fetchClientConfig() for client-side access
// These are only for server-side usage
export const CONTACT_URL =
  process.env.CONTACT_URL || 'https://example.com/contact'
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || 'support@internetofmaterials.com'

// -------------------------------------------------------
// Import-related constants
// -------------------------------------------------------

// Session storage keys for import state
export const IMPORT_HEADER_ROW_KEY = 'import_header_row'
export const IMPORT_START_ROW_KEY = 'import_start_row'
export const IMPORT_COLUMN_MAPPING_KEY = 'import_column_mapping'
export const IMPORT_MAPPING_TEMPLATES_KEY = 'import_mapping_templates'

// File processing limits - use fetchClientConfig() for client-side access
// These are only for server-side usage
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '100') // Max file size in MB
export const STREAM_CHUNK_SIZE = 2 * 1024 * 1024 // 2MB chunks for file streaming
export const IMPORT_CHUNK_SIZE = parseInt(
  process.env.IMPORT_CHUNK_SIZE || '500'
) // Process objects at a time (UI chunking)
export const API_CHUNK_SIZE = parseInt(process.env.API_CHUNK_SIZE || '100') // API storage chunk size (server-side)
export const SIZE_THRESHOLD_MB = parseInt(process.env.SIZE_THRESHOLD_MB || '5') // Use chunking for datasets larger than MB
export const MAX_PREVIEW_ROWS = 500 // Maximum number of rows to process for preview

// -------------------------------------------------------
// Security & DoS Protection Constants
// -------------------------------------------------------

// Import payload limits - use fetchClientConfig() for client-side access
// These are only for server-side usage
export const MAX_IMPORT_PAYLOAD_MB = parseInt(
  process.env.MAX_IMPORT_PAYLOAD_MB || '100'
) // Max import payload size (should match or be less than file size)
export const MAX_OBJECTS_PER_IMPORT = parseInt(
  process.env.MAX_OBJECTS_PER_IMPORT || '50000'
) // Max objects per import
export const MAX_CONCURRENT_JOBS_PER_USER = parseInt(
  process.env.MAX_CONCURRENT_JOBS_PER_USER || '5'
) // Max concurrent import jobs

// Import processing configuration (optimized for performance)
export const API_BATCH_SIZE = parseInt(process.env.API_BATCH_SIZE || '25') // Objects per API request (smaller batches for faster processing)
export const API_REQUEST_DELAY = parseInt(process.env.API_REQUEST_DELAY || '50') // Delay between requests (ms) (reduced for faster throughput)
export const PARALLEL_REQUESTS = parseInt(process.env.PARALLEL_REQUESTS || '15') // Concurrent API requests (increased for better parallelism)

// Advanced performance tuning
export const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '100') // Maximum batch size for very large imports
export const MIN_BATCH_SIZE = parseInt(process.env.MIN_BATCH_SIZE || '10') // Minimum batch size for small imports
export const ADAPTIVE_BATCHING = process.env.ADAPTIVE_BATCHING !== 'false' // Enable adaptive batch sizing based on payload

// Rate limiting (configurable via environment)
export const RATE_LIMIT_WINDOW_MINUTES = parseInt(
  process.env.RATE_LIMIT_WINDOW_MINUTES || '10'
) // Rate limit window
export const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_MAX_REQUESTS || '20'
) // Max requests per window
export const RATE_LIMIT_WARNING_THRESHOLD = parseInt(
  process.env.RATE_LIMIT_WARNING_THRESHOLD || '15'
) // Warning threshold

// Redis TTL settings (configurable via environment)
export const REDIS_JOB_TTL_HOURS = parseInt(
  process.env.REDIS_JOB_TTL_HOURS || '24'
) // Job data TTL in hours
export const REDIS_CHUNK_TTL_HOURS = parseInt(
  process.env.REDIS_CHUNK_TTL_HOURS || '6'
) // Chunk data TTL in hours
export const REDIS_RATE_LIMIT_TTL_MINUTES = RATE_LIMIT_WINDOW_MINUTES // Rate limit TTL matches window

// TLS/Certificate settings
export const VERIFY_CERTIFICATES = process.env.VERIFY_CERTIFICATES === 'true' // TLS certificate verification
export const ALLOW_INSECURE_FALLBACK =
  process.env.ALLOW_INSECURE_FALLBACK !== 'false' // Allow insecure fallback (default true for dev)

// Logging configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info' // Log level: debug, info, warn, error
export const LOG_DESTINATIONS = process.env.LOG_DESTINATIONS || 'console,sentry' // Comma-separated: console,sentry,sdk
export const LOG_CONSOLE = process.env.LOG_CONSOLE !== 'false' // Enable console logging
export const LOG_SENTRY = process.env.LOG_SENTRY !== 'false' // Enable Sentry logging
export const LOG_SDK = process.env.LOG_SDK === 'true' // Enable SDK logging

// Health UI Configuration
export const HEALTH_UI_ENABLED = process.env.HEALTH_UI_ENABLED !== 'false' // Enable health UI
export const HEALTH_UI_ALLOWED_CERTS = process.env.HEALTH_UI_ALLOWED_CERTS || '' // Comma-separated cert fingerprints/serials

// -------------------------------------------------------
// Process-related constants
// -------------------------------------------------------

// Process types (based on actual API model)
export const PROCESS_TYPES = [
  { value: 'processing', label: 'Processing' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'recycling', label: 'Recycling' },
  { value: 'disposal', label: 'Disposal' },
]

// Unit categories for material selection
export const UNIT_CATEGORIES = {
  volume: { label: 'Volume', units: ['L', 'mL', 'm³', 'gal'] },
  weight: { label: 'Weight/Mass', units: ['kg', 'g', 't', 'lb'] },
  area: { label: 'Area', units: ['m²', 'cm²', 'ft²'] },
  length: { label: 'Length', units: ['m', 'mm', 'cm', 'ft', 'in'] },
  count: { label: 'Count', units: ['pcs', 'ea', 'units', 'items'] },
  energy: {
    label: 'Energy/Environmental',
    units: ['kWh', 'kg CO2e', 'MJ', 'BTU'],
  },
}

export * from './view-types'
export * from './client'
