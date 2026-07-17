'use client'

// Cross-cutting file hooks over client.files. Uploads AUTO-ATTACH to their target
// ({entityId, propertyId?, valueId?}) on complete, so files are managed out of band from the
// entity PATCH — no DraftValue.files / builder diff. The sheet displays value.files[] from the
// read model and invalidates the entity after upload/delete. Kept out of the barrel like entities.ts.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FileTarget, UploadInput, UploadProgress } from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

// Byte-upload WITHOUT attaching: bytes land in the files collection and the minted id is returned, to be
// authored inline in an entity body (the lazy, Save-all path — see plan §18). No entity invalidation:
// the entity mutation that follows owns the cache. Distinct from useFileUpload (target auto-attach).
export function useFileByteUpload() {
  const client = useIomClient()
  return useMutation({
    mutationFn: (vars: {
      file: UploadInput
      onProgress?: (p: UploadProgress) => void
      signal?: AbortSignal
    }) =>
      client.files.upload(vars.file, undefined, {
        onProgress: vars.onProgress,
        signal: vars.signal,
      }),
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

export function useFileDelete() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; entityId?: string }) =>
      client.files.delete(vars.id),
    onSuccess: (_data, vars) => {
      if (vars.entityId) {
        qc.invalidateQueries({
          queryKey: queryKeys.objects.detail(vars.entityId),
        })
      }
    },
  })
}

// Presigned URL getters — the client returns `{ url }` (never the bytes); the JWT never reaches S3.
export function useFileUrls() {
  const client = useIomClient()
  return {
    getPreviewUrl: (id: string) => client.files.preview(id).then((r) => r.url),
    getDownloadUrl: (id: string) =>
      client.files.download(id).then((r) => r.url),
  }
}
