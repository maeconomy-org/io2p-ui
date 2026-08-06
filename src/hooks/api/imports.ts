'use client'

// Bulk import over client.imports. Objects only, with parent/child links — no processes, no
// file uploads (a file needs an entity the import has not created yet), no templates.
//
// The shape of this feature is unusual for the app, so it gets its own hooks rather than the
// generic entity ones: a job is a long-running server process the browser watches, not a record
// the browser owns. Two consequences run through everything below — the staging phase is the
// only part that needs the tab open, and a RUNNING job must be polled while every other query in
// the app stays on the app-wide `staleTime: Infinity`.

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ImportItemDTO,
  ImportItemInput,
  ImportJobDTO,
  ListImportItemsQuery,
  ListImportsQuery,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

/**
 * Job states the worker will not move again. Everything else is still in flight, which is what
 * decides whether to keep polling.
 */
const TERMINAL: ReadonlySet<string> = new Set([
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
])

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status)
}

/**
 * Poll interval for a live job.
 *
 * 2.5s rather than 1s deliberately: the node's global rate limit is 300 requests a minute, and a
 * 10-minute import polled every second would spend the entire budget on one browser tab watching
 * one job — throttling the very import it is watching, plus every other tab the user has open. A
 * bulk import is not a live cursor; a couple of seconds of lag is imperceptible against a job
 * that runs for minutes.
 */
const POLL_MS = 2500

/** One job, polled while it is running and left alone once it is not. */
export function useImportJob(id: string | null) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.imports.detail(id ?? ''),
    queryFn: () => client.imports.get(id!),
    enabled: Boolean(id),
    // The app-wide default is `staleTime: Infinity` with no refetching, which would freeze a
    // running job's progress at whatever the first response said. Both overrides are needed.
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isTerminal(status) ? false : POLL_MS
    },
  })
}

/** The caller's own imports, newest first. Owner-only — there is nothing to share. */
export function useImports(query?: ListImportsQuery) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.imports.list(query),
    queryFn: () => client.imports.list(query),
  })
}

/**
 * The rows of one job — the per-row failure report AND the tempId → id map.
 *
 * Pass `{ status: 'failed' }` for the report. With no filter, `entityId` per row is how the
 * caller finds what was created (for example to attach files afterwards, in a second pass).
 */
export function useImportItems(
  id: string | null,
  query?: ListImportItemsQuery
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.imports.items(id ?? '', query),
    queryFn: () => client.imports.items(id!, query),
    enabled: Boolean(id),
  })
}

export interface RunImportInput {
  items: ImportItemInput[]
  /** Shown in the job list. Without it a user with six imports sees six ids. */
  filename?: string
}

export interface ImportProgress {
  phase: 'idle' | 'staging' | 'validating' | 'starting' | 'started' | 'error'
  staged: number
  total: number
}

/**
 * Run the whole staged flow: create → stage → validate → start.
 *
 * Kept as ONE mutation rather than four, because the four are not independently useful: a job
 * created but never started is invisible work the user cannot see or resume, and staging without
 * starting leaves rows the worker never picks up. The caller wants "import this sheet".
 *
 * The dry-run is not optional here. It runs the same pure checks `start` runs, and it is the last
 * moment anything can be refused for free — after `start` the objects exist, and the store is
 * append-only, so a mis-mapped import can only be soft-deleted afterwards, never removed.
 */
export function useRunImport() {
  const client = useIomClient()
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<ImportProgress>({
    phase: 'idle',
    staged: 0,
    total: 0,
  })

  const mutation = useMutation({
    mutationFn: async ({ items, filename }: RunImportInput) => {
      setProgress({ phase: 'staging', staged: 0, total: items.length })

      const job = await client.imports.create({
        total: items.length,
        ...(filename ? { filename } : {}),
      })

      // `stage` chunks by measured bytes and keys each chunk stably, so this is safe to retry.
      await client.imports.stage(job.id, items, {
        onProgress: (staged, total) => {
          setProgress({ phase: 'staging', staged, total })
        },
      })

      setProgress((p) => ({ ...p, phase: 'validating' }))
      const dryRun = await client.imports.validate(job.id)
      if (!dryRun.ok) {
        // Refuse BEFORE anything is written. The job stays a draft, so the user can fix the
        // mapping and submit again with nothing to clean up.
        setProgress((p) => ({ ...p, phase: 'error' }))
        return { job, problems: dryRun.problems, started: false as const }
      }

      setProgress((p) => ({ ...p, phase: 'starting' }))
      const started = await client.imports.start(job.id)
      setProgress((p) => ({ ...p, phase: 'started' }))
      return { job: started, problems: [], started: true as const }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.lists(),
      })
      if (result.started) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.imports.detail(result.job.id),
        })
      }
    },
  })

  const reset = useCallback(() => {
    setProgress({ phase: 'idle', staged: 0, total: 0 })
    mutation.reset()
  }, [mutation])

  return { ...mutation, progress, reset }
}

/**
 * Start a job that was staged but never handed over.
 *
 * Only meaningful for a DRAFT that is fully staged — the wizard normally stages and starts in one
 * mutation, so a draft here means the browser closed between the two. The rows are already on the
 * node, which is exactly why this is one call and not a re-upload.
 */
export function useStartImport() {
  const client = useIomClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.imports.start(id),
    onSuccess: (job: ImportJobDTO) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.detail(job.id),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.lists(),
      })
    },
  })
}

/**
 * Ask the worker to stop.
 *
 * Cooperative, and it does NOT undo: objects already created stay, because an append-only store
 * cannot take them back. The item list is how the user finds them.
 */
export function useCancelImport() {
  const client = useIomClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.imports.cancel(id),
    onSuccess: (job: ImportJobDTO) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.detail(job.id),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.lists(),
      })
    },
  })
}

/** `ok` is the success count; `processed` counts ATTEMPTS. Show both — they answer different questions. */
export function importSuccessRate(job: ImportJobDTO): number {
  return job.total === 0 ? 0 : Math.round((job.ok / job.total) * 100)
}

export type { ImportItemDTO, ImportJobDTO, ImportItemInput }
