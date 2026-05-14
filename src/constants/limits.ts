/**
 * Import and file processing limits
 * Most values can be hardcoded - only critical ones need env vars
 */

// Session storage keys for import state
export const IMPORT_HEADER_ROW_KEY = 'import_header_row'
export const IMPORT_START_ROW_KEY = 'import_start_row'
export const IMPORT_COLUMN_MAPPING_KEY = 'import_column_mapping'
export const IMPORT_MAPPING_TEMPLATES_KEY = 'import_mapping_templates'

// File processing limits
// Import path: the file is parsed into memory (xlsx/csv), so this cap protects
// the Node process from OOM. Attachment path: the bytes stream through S3 in
// 8 MB parts and never sit in memory whole, so the cap is much higher.
export const MAX_IMPORT_FILE_SIZE_MB = 100
export const MAX_ATTACHMENT_SIZE_MB = 1024
// Per-drop file count cap. The OS file picker and folder drops can yield
// thousands of File entries; without a ceiling, hashing/init storms can OOM
// the page or saturate the upload queue. Rejected as a whole batch — partial
// accept would leave the user guessing which files made it.
export const MAX_FILES_PER_DROP = 100
export const STREAM_CHUNK_SIZE = 2 * 1024 * 1024 // 2MB chunks for file streaming
export const IMPORT_CHUNK_SIZE = 500 // Process objects at a time (UI chunking)
export const API_CHUNK_SIZE = 100 // API storage chunk size (server-side)
export const SIZE_THRESHOLD_MB = 5 // Use chunking for datasets larger than this
export const MAX_PREVIEW_ROWS = 500 // Maximum number of rows to process for preview

// Import payload limits
export const MAX_IMPORT_PAYLOAD_MB = 100 // Max import payload size
export const MAX_OBJECTS_PER_IMPORT = 50000 // Max objects per import
export const MAX_CONCURRENT_JOBS_PER_USER = 5 // Max concurrent import jobs

// Import processing configuration (optimized for performance)
export const API_BATCH_SIZE = 25 // Objects per API request
export const API_REQUEST_DELAY = 50 // Delay between requests (ms)
export const PARALLEL_REQUESTS = 15 // Concurrent API requests

// Advanced performance tuning
export const MAX_BATCH_SIZE = 100 // Maximum batch size for very large imports
export const MIN_BATCH_SIZE = 10 // Minimum batch size for small imports
export const ADAPTIVE_BATCHING = true // Enable adaptive batch sizing

// Redis Cache Configuration
export const REDIS_JOB_TTL_HOURS = 24
export const REDIS_CHUNK_TTL_HOURS = 6

// Rate Limiting Configuration
export const RATE_LIMIT_WINDOW_MINUTES = 10
export const RATE_LIMIT_MAX_REQUESTS = 100 // Higher for development/internal use
export const RATE_LIMIT_WARNING_THRESHOLD = 80
