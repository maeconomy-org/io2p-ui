import type { QueryClient } from '@tanstack/react-query'

import type { FileUploadService, FileUploadTask } from './upload-service'

// Surface exposed to Playwright via `window.__testHooks`. Kept narrow on
// purpose: only timing/concurrency primitives, never business logic.
export type TestHooks = {
  uploadService: {
    setMaxConcurrent: (n: number) => void
    forceWatchdog: (id: string) => void
    getTask: (id: string) => FileUploadTask | undefined
    getAllTasks: () => FileUploadTask[]
  }
  queryClient: {
    invalidate: (queryKey: readonly unknown[]) => Promise<void>
  }
}

declare global {
  interface Window {
    __testHooks?: TestHooks
  }
}

/**
 * Wire `window.__testHooks` so Playwright specs can drive concurrency and
 * force watchdog timing without sleeping or reaching into private state.
 * Gated on NODE_ENV so the entire body is dead-code-eliminated from prod
 * bundles by Next's compile-time `process.env.NODE_ENV` replacement.
 *
 * Returns a cleanup that removes the global — call from the same effect
 * that installed it so re-renders don't leak stale service references.
 */
export function installTestHooks(
  service: FileUploadService,
  queryClient: QueryClient
): () => void {
  if (process.env.NODE_ENV === 'production') return () => {}
  if (typeof window === 'undefined') return () => {}

  window.__testHooks = {
    uploadService: {
      setMaxConcurrent: (n) => service.setMaxConcurrent(n),
      forceWatchdog: (id) => service.forceWatchdog(id),
      getTask: (id) => service.getTask(id),
      getAllTasks: () => service.getAllTasks(),
    },
    queryClient: {
      invalidate: (queryKey) => queryClient.invalidateQueries({ queryKey }),
    },
  }

  return () => {
    if (typeof window !== 'undefined' && window.__testHooks) {
      delete window.__testHooks
    }
  }
}
