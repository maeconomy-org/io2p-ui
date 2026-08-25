'use client'

// Bulk import over client.imports. Objects only, with parent/child links — no processes, no
// file uploads (a file needs an entity the import has not created yet), no templates.
//
// The shape of this feature is unusual for the app, so it gets its own hooks rather than the
// generic entity ones: a job is a long-running server process the browser watches, not a record
// the browser owns. Two consequences run through everything below — the staging phase is the
// only part that needs the tab open, and a RUNNING job must be polled while every other query in
// the app stays on the app-wide `staleTime: Infinity`.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type {
  ImportItemDTO,
  ImportItemInput,
  ImportJobDTO,
  ListImportItemsQuery,
  ListImportsQuery,
} from 'io2p-client'

import { useOptionalImportWatch } from '@/contexts/import-watch-context'
import { useIomClient } from '@/lib/io2p'
import { iomDetail } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
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

/**
 * The spec's maximum. `page`/`size` are REQUIRED on this route, but `ListImportItemsQuery` is a
 * `Partial<>` — so omitting them compiles and silently takes an undocumented server default.
 */
export const ITEMS_PAGE_SIZE = 100

/** One job, polled while it is running and left alone once it is not. */
export function useImportJob(id: string | null) {
  const client = useIomClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.imports.detail(id ?? ''),
    queryFn: ({ signal }) => client.imports.get(id!, { signal }),
    enabled: Boolean(id),
    // The app-wide default is `staleTime: Infinity` with no refetching, which would freeze a
    // running job's progress at whatever the first response said. Both overrides are needed.
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isTerminal(status) ? false : POLL_MS
    },
  })

  const status = query.data?.status
  const seen = useRef<{ id: string; status: string } | null>(null)

  /**
   * The moment a watched job finishes, everything it touched is stale.
   *
   * Polling merely STOPPED before, invalidating nothing: the per-row report still held the
   * mid-run rows, the jobs list still said "running", and — the one users notice — the objects
   * list had never heard of the objects just created, so "View objects" landed on a page that did
   * not contain them.
   *
   * Keyed on the TRANSITION, not on the status: opening a job that finished yesterday changed
   * nothing, and invalidating `objects.all` on every such open would refetch the whole list for
   * no reason. Nothing is invalidated on a normal poll either, only on the edge.
   */
  useEffect(() => {
    if (!id || !status) return
    const previous = seen.current
    seen.current = { id, status }
    if (!previous || previous.id !== id) return
    if (isTerminal(previous.status) || !isTerminal(status)) return

    logger.info('import_finished', { jobId: id, status })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.imports.detail(id),
    })
    void queryClient.invalidateQueries({ queryKey: queryKeys.imports.lists() })
    // The objects the job created. Broad on purpose — the import can land anywhere in the tree,
    // so there is no narrower key that is guaranteed to cover it.
    void queryClient.invalidateQueries({ queryKey: queryKeys.objects.all })
  }, [id, status, queryClient])

  return query
}

/** The caller's own imports, newest first. Owner-only — there is nothing to share. */
export function useImports(query?: ListImportsQuery) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.imports.list(query),
    queryFn: ({ signal }) => client.imports.list(query, { signal }),
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
    queryFn: ({ signal }) => client.imports.items(id!, query, { signal }),
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
  const watcher = useOptionalImportWatch()
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
        //
        // Recorded because it is otherwise invisible: a whole import rejected after every item
        // was uploaded produced no server-side trace at all, so a deployment where this happens
        // routinely (a sheet shape the mapper handles badly) looks exactly like one where it
        // never happens. The COUNT only — a problem message quotes the user's own data.
        logger.warn('import_refused', {
          jobId: job.id,
          items: items.length,
          problems: dryRun.problems.length,
        })
        setProgress((p) => ({ ...p, phase: 'error' }))
        return { job, problems: dryRun.problems, started: false as const }
      }

      setProgress((p) => ({ ...p, phase: 'starting' }))
      const started = await client.imports.start(job.id)
      setProgress((p) => ({ ...p, phase: 'started' }))
      logger.info('import_started', { jobId: job.id, items: items.length })
      return { job: started, problems: [], started: true as const }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.imports.lists(),
      })
      if (result.started) {
        // SEEDED, not invalidated. `useImportJob` fires its invalidation on the TRANSITION to a
        // terminal status, and deliberately ignores its first observation — so a job that
        // finishes inside one 2.5s poll was only ever seen finished, and the edge never
        // happened. Writing the 202's `queued` into the cache makes the watcher's first
        // observation a fact rather than a race: the transition is then always observable.
        //
        // Invalidating `objects.all` HERE instead would not work either. `start` returns a 202
        // and the job is queued — zero objects exist yet, so the refetch would be just as stale.
        queryClient.setQueryData(
          queryKeys.imports.detail(result.job.id),
          result.job
        )
        // Armed here, not from a UI click: the user can navigate away the instant a run starts.
        watcher?.watch(result.job.id)
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
 *
 * `start` re-runs the same planner `validate` does and refuses with a 422 naming every bad row, so
 * a draft that cannot be started says why. Nothing is written before that check: there is no
 * stored "was this validated" flag to consult, and there should not be — it would be a cached
 * predicate over rows that further staging can change.
 */
export function useStartImport() {
  const client = useIomClient()
  const queryClient = useQueryClient()
  const t = useTranslations()
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
    onError: (error, id) => {
      logger.error('Import start refused', { jobId: id, err: error })
      const detail = iomDetail(error)
      toast.error(
        detail
          ? t('import.detail.startRefused', { reason: detail })
          : t('import.detail.startFailed')
      )
    },
  })
}

/**
 * Ask the worker to stop — and the only way to retire a DRAFT.
 *
 * Cooperative for a running job, and it does NOT undo: objects already created stay, because an
 * append-only store cannot take them back. On a draft nothing is running, so core marks it
 * `cancelled` at once and it can never be started. That is the sole disposal route: there is no
 * DELETE on `/imports/{id}`, and core's reaper only sweeps `queued` and `running`.
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
    onError: (error, id) => {
      logger.error('Import cancel failed', { jobId: id, err: error })
    },
  })
}

/** `ok` is the success count; `processed` counts ATTEMPTS. Show both — they answer different questions. */
export function importSuccessRate(job: ImportJobDTO): number {
  return job.total === 0 ? 0 : Math.round((job.ok / job.total) * 100)
}

/**
 * Over, having attempted nothing — so it has counters but no outcome.
 *
 * Discarding a draft made this reachable: core keeps `total` as the history entry and deletes the
 * staged rows, leaving `cancelled` with every counter at zero. Read as an outcome that is "all
 * zero, no failures", which reports as total success.
 */
export function endedWithoutRunning(job: ImportJobDTO): boolean {
  return isTerminal(job.status) && job.processed === 0
}

export type { ImportItemDTO, ImportJobDTO, ImportItemInput }
