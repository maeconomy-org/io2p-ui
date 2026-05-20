import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

// Lower bound for staleTime — if the server returns a TTL shorter than this,
// we still leave a refetch window so the UI doesn't churn.
const PRESIGNED_MIN_STALE_MS = 60_000
// Refresh this many ms before the server-reported expiry.
const PRESIGNED_REFRESH_LEAD_MS = 60_000
// Default fallback when the response has no expiresAt yet (initial fetch).
const PRESIGNED_FALLBACK_STALE_MS = 14 * 60_000
const PRESIGNED_GC_MS = 15 * 60_000

/**
 * Derive `staleTime` from the server-reported `expiresAt` of a presigned URL
 * response. TanStack Query measures stale-ness against `dataUpdatedAt`, so we
 * subtract the fetch timestamp and leave a refresh lead so an interaction
 * near the boundary doesn't 403.
 */
// Exported for unit testing. Not part of the public hook surface.
export function presignedStaleTime(query: {
  state: { data?: { expiresAt?: string }; dataUpdatedAt: number }
}): number {
  const exp = query.state.data?.expiresAt
  if (!exp) return PRESIGNED_FALLBACK_STALE_MS
  const expMs = Date.parse(exp)
  if (!Number.isFinite(expMs)) return PRESIGNED_FALLBACK_STALE_MS
  const stale = expMs - PRESIGNED_REFRESH_LEAD_MS - query.state.dataUpdatedAt
  return Math.max(PRESIGNED_MIN_STALE_MS, stale)
}

/**
 * Resolve a presigned preview URL for an internal S3-backed file.
 *
 * `fileReference` is the storage UUID stored on the UUFile record — NOT the
 * UUFile's own `uuid`. The file-storage service indexes blobs by their own
 * UUID, which lives on `UUFileDTO.fileReference`.
 */
/**
 * Refetch a presigned-URL query when the tab returns to visible AND the cached
 * URL is within `PRESIGNED_REFRESH_LEAD_MS` of expiry. Compensates for the
 * global `refetchOnWindowFocus: false` so users don't hit 403s after long tab
 * suspensions.
 */
function useRefetchOnVisibleNearExpiry(
  query: UseQueryResult<{ expiresAt?: string } | undefined>
) {
  const refetch = query.refetch
  const expiresAt = query.data?.expiresAt
  useEffect(() => {
    if (typeof document === 'undefined' || !expiresAt) return
    const expMs = Date.parse(expiresAt)
    if (!Number.isFinite(expMs)) return

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() + PRESIGNED_REFRESH_LEAD_MS >= expMs) {
        void refetch()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [expiresAt, refetch])
}

export function usePreviewUrl(
  fileReference: string | null | undefined,
  enabled = true
) {
  const client = useIomSdkClient()
  const query = useQuery({
    queryKey: queryKeys.files.previewUrl(fileReference ?? ''),
    queryFn: ({ signal }) =>
      client.fileStorage.getPreviewUrl(fileReference!, { signal }),
    enabled: enabled && !!fileReference,
    staleTime: presignedStaleTime,
    gcTime: PRESIGNED_GC_MS,
    retry: 1,
  })
  useRefetchOnVisibleNearExpiry(query)
  return query
}

export function useFilesApi() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const t = useTranslations()

  const useSoftDeleteFile = () => {
    return useMutation({
      mutationFn: async (fileUuid: string) => {
        const response = await client.node.softDeleteFile(fileUuid)

        return response
      },
      onSuccess: () => {
        toast.success(t('objects.fileDeletedSuccess'))

        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.details(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
      onError: (error) => {
        logger.error('Failed to delete file:', error)
        toast.error(t('objects.fileDeleteFailed'))
      },
    })
  }

  return {
    useSoftDeleteFile,
  }
}
