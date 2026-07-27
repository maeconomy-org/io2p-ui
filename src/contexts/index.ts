export * from './auth-context'
export * from './query-context'
export * from './search-context'

/**
 * DO NOT add `export * from './upload-queue-context'` here.
 *
 * Two upload systems are mounted side by side during the io2p migration, and BOTH export
 * `useUploadQueue` and `useOptionalUploadQueue`. Star-exporting both would make those names
 * ambiguous, and an ambiguous star-export is silently EXCLUDED from the module rather than being an
 * error — every importer would get `undefined` and fail at call time with no build signal.
 *
 * The new system is imported by direct path (`@/contexts/upload-queue-context`) on purpose. This
 * barrel exposes only the legacy one, which dies with the Processes vertical.
 */
export * from './upload-context'
