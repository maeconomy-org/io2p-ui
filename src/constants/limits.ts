/**
 * File and import limits.
 *
 * Most of this file went with the old import pipeline. What it held was tuning for a client-side
 * batching loop — batch sizes, request delays, parallelism, adaptive sizing, Redis TTLs, a
 * per-user job cap — and none of it has an owner any more: the node runs the job, decides its own
 * concurrency and reports its own progress. The browser's part is now to parse a file and hand
 * over the rows.
 */

// File processing limits.
// Import path: the file is parsed into memory (xlsx/csv), so this cap protects the browser from
// OOM. Attachment path: the bytes stream through S3 in 8 MB parts and never sit in memory whole,
// so the cap is much higher.
export const MAX_IMPORT_FILE_SIZE_MB = 100
export const MAX_ATTACHMENT_SIZE_MB = 1024
// Per-drop file count cap. The OS file picker and folder drops can yield thousands of File
// entries; without a ceiling, hashing/init storms can OOM the page or saturate the upload queue.
// Rejected as a whole batch — partial accept would leave the user guessing which files made it.
export const MAX_FILES_PER_DROP = 100

// Import payload limits — these MIRROR the node's own caps, and exist so the UI can say no early
// with a sentence the user can act on, rather than relaying a 413 or a 422.
export const MAX_IMPORT_PAYLOAD_MB = 100
export const MAX_OBJECTS_PER_IMPORT = 50_000
