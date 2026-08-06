/**
 * Limits that are NOT deployment-tunable.
 *
 * Everything tunable lives in runtime config (`buildRuntimeConfig` → `__IOM_CONFIG__`) and is read
 * from there: the attachment cap through `useAppConfig().maxAttachmentSizeMB`, the import file size
 * and object count through `importLimits()` in `use-import-wizard`.
 *
 * This file used to hold a hardcoded copy of each of those as well — `MAX_IMPORT_FILE_SIZE_MB`,
 * `MAX_ATTACHMENT_SIZE_MB`, `MAX_IMPORT_PAYLOAD_MB`, `MAX_OBJECTS_PER_IMPORT` — and NONE of the four
 * had an importer. A duplicated default nothing reads is worse than no default: it looks like the
 * answer to "what is the limit here?" while the real one is elsewhere and may disagree.
 */

// Per-drop file count cap. The OS file picker and folder drops can yield thousands of File
// entries; without a ceiling, hashing/init storms can OOM the page or saturate the upload queue.
// Rejected as a whole batch — partial accept would leave the user guessing which files made it.
export const MAX_FILES_PER_DROP = 100
