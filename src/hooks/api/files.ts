'use client'

// Cross-cutting file hooks over client.files. Uploads AUTO-ATTACH to their target
// ({entityId, propertyId?, valueId?}) on complete — the upload IS the attach, so a target must
// already exist. Preview/download urls are NOT part of the entity read: the enricher inlines only
// `thumbnailUrl`, so every other url is minted on demand here.

import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type {
  FileTarget,
  Io2pClient,
  SignedUrlResponse,
  UploadInput,
  UploadProgress,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { iomStatus } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import { queryKeys } from '@/lib/query-keys'

export type SignedUrlKind = 'preview' | 'download'

/** Re-mint this far ahead of the server's expiry — covers clock skew and a long-lived media element. */
export const SIGNED_URL_REFRESH_LEAD_MS = 60_000
/** Floor, so a url that arrives already near expiry still gets a usable window instead of churning. */
const SIGNED_URL_MIN_STALE_MS = 30_000
/** Only until the first response tells us the real expiry. */
const SIGNED_URL_FALLBACK_STALE_MS = 300_000

/**
 * Stale-time derived from the server's own `expiresAt` rather than a constant mirroring
 * `PRESIGN_GET_TTL` — the API now reports it, so the client no longer has to guess (and no longer
 * silently breaks if ops changes the TTL). React Query measures staleness from `dataUpdatedAt`, so
 * subtract it and keep a refresh lead: an interaction right on the boundary would otherwise be handed
 * a url that 403s.
 */
export function signedUrlStaleTime(query: {
  state: { data?: SignedUrlResponse; dataUpdatedAt: number }
}): number {
  const expiresAt = query.state.data?.expiresAt
  if (!expiresAt || !Number.isFinite(expiresAt)) {
    return SIGNED_URL_FALLBACK_STALE_MS
  }
  return Math.max(
    SIGNED_URL_MIN_STALE_MS,
    expiresAt - SIGNED_URL_REFRESH_LEAD_MS - query.state.dataUpdatedAt
  )
}

/**
 * Query options for ONE on-demand signed url. A plain factory rather than a hook so prefetch,
 * `fetchQuery` and a `useQuery` all share the same key and TTL policy — that shared identity is what
 * makes a hover-prefetch a cache hit at click time.
 *
 * Every option below is load-bearing: the app-wide defaults are `staleTime: Infinity` with no
 * refetching (query-context.tsx), which would cache a presigned url forever and 403 after it expires.
 */
export function signedFileUrlQuery(
  client: Io2pClient,
  id: string,
  kind: SignedUrlKind,
  variant?: string
) {
  return {
    queryKey: queryKeys.files.url(id, kind, variant),
    // Returns the WHOLE response, not just the url: staleTime needs `expiresAt` to see it.
    // No AbortSignal — io2p's preview/download take no request options.
    queryFn: async () =>
      kind === 'preview'
        ? await client.files.preview(id, variant ? { variant } : undefined)
        : await client.files.download(id),
    staleTime: signedUrlStaleTime,
    gcTime: SIGNED_URL_FALLBACK_STALE_MS,
    refetchOnMount: true,
    // Refetches only when stale, which is exactly "the url is near expiry and the user came back".
    refetchOnWindowFocus: true,
    // A 404 means deleted / not ready / unknown variant — retrying can't change that.
    retry: false,
  }
}

/**
 * Hover/focus prefetch handlers so the url is already cached when the user clicks. `mouseenter` and
 * `focus` bubble up from child elements, so a naive handler mints once per child — the ref guards
 * re-entry and resets on leave/blur.
 */
export function useSignedUrlPrefetch(
  id: string | undefined,
  kind: SignedUrlKind,
  options?: { enabled?: boolean; variant?: string }
) {
  const client = useIomClient()
  const qc = useQueryClient()
  const armed = useRef<string | null>(null)
  const enabled = options?.enabled ?? true
  const variant = options?.variant

  const arm = useCallback(() => {
    if (!enabled || !id || armed.current === id) return
    armed.current = id
    // prefetchQuery never rejects, so a failed prefetch can't raise an unhandled rejection — the
    // click path surfaces the error instead.
    void qc.prefetchQuery(signedFileUrlQuery(client, id, kind, variant))
  }, [client, qc, id, kind, variant, enabled])

  const disarm = useCallback(() => {
    armed.current = null
  }, [])

  return {
    onMouseEnter: arm,
    onFocus: arm,
    onMouseLeave: disarm,
    onBlur: disarm,
  }
}

/**
 * Mint `{url}` on an authenticated JSON call, then NAVIGATE a synthetic anchor. Never fetches the
 * bytes: the JWT must not reach S3 (it would 403), and the presigned url already carries
 * `Content-Disposition: attachment` with the original filename, so the server — not the `download`
 * attribute — forces the save.
 */
export function triggerBrowserDownload(url: string, fileName?: string): void {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  if (fileName) a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Click-to-download for one file. Instantiate per row so `isPending` scopes to that row. */
export function useFileDownload() {
  const client = useIomClient()
  const qc = useQueryClient()
  const t = useTranslations()
  return useMutation({
    mutationFn: async (vars: { id: string; fileName?: string }) => {
      // fetchQuery honours staleTime, so a hover-prefetched url returns without a second mint.
      const { url } = await qc.fetchQuery(
        signedFileUrlQuery(client, vars.id, 'download')
      )
      triggerBrowserDownload(url, vars.fileName)
      return url
    },
    onError: (error, vars) => {
      logger.error('File download failed', {
        fileId: vars.id,
        err: error,
      })
      toast.error(
        iomStatus(error) === 404
          ? t('objects.files.unavailable')
          : t('common.downloadFailed')
      )
    },
  })
}

export function useFileUpload() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      file: UploadInput
      target: FileTarget
      onProgress?: (p: UploadProgress) => void
      signal?: AbortSignal
    }) =>
      client.files.upload(vars.file, vars.target, {
        onProgress: vars.onProgress,
        signal: vars.signal,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.objects.detail(vars.target.entityId),
      })
    },
  })
}

/**
 * One stored file's record. Only worth fetching for a BARE ref: enrichment skips files that aren't
 * live, leaving `{id, kind}` with no metadata, and this is what says WHY — `deleted: true` versus a
 * `pending`/`aborted` status. `files.get` deliberately does not filter deleted rows.
 */
export function fileRecordQuery(client: Io2pClient, id: string) {
  return {
    queryKey: queryKeys.files.detail(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      client.files.get(id, { signal }),
    staleTime: 60_000,
    retry: false,
  }
}

/**
 * Soft-delete. The blob is never physically removed and the entity keeps its reference, so this is
 * always reversible via `useFileRestore`. Requires ADMIN on the parent entity, not write.
 */
export function useFileDelete() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; entityId?: string }) =>
      client.files.delete(vars.id),
    onSuccess: (_data, vars) => invalidateFile(qc, vars),
  })
}

/** Undo a soft delete. Same ADMIN authority as the delete. */
export function useFileRestore() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; entityId?: string }) =>
      client.files.restore(vars.id),
    onSuccess: (_data, vars) => invalidateFile(qc, vars),
  })
}

function invalidateFile(
  qc: ReturnType<typeof useQueryClient>,
  vars: { id: string; entityId?: string }
) {
  qc.invalidateQueries({ queryKey: queryKeys.files.detail(vars.id) })
  // Any minted url is dead now (preview/download only resolve live files), and stale on restore.
  qc.removeQueries({ queryKey: [...queryKeys.files.all, 'url'] })
  if (vars.entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.objects.detail(vars.entityId) })
  }
}
