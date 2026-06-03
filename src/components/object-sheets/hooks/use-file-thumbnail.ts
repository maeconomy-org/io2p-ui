'use client'

import { usePreviewUrl } from '@/hooks'
import { detectMimeType, detectPreviewKind } from '@/lib'
import type { FileData } from '@/types'

import { isExternalFileReference } from '../utils'

/**
 * Resolved thumbnail for a file tile.
 * - `icon`    — render a file-type glyph (unsupported kind, external ref, PDF…)
 * - `loading` — preview URL not resolved yet (or tile not yet in viewport)
 * - `ready`   — render the image at `src`
 * - `error`   — preview URL failed; caller falls back to the icon
 */
export type ThumbnailState =
  | { status: 'icon' }
  | { status: 'loading' }
  | { status: 'ready'; src: string; tag: 'img' }
  | { status: 'error' }

/**
 * Resolve a thumbnail for one file in the grid view.
 *
 * Today only internal (S3-backed) images produce a real thumbnail: we render
 * the presigned preview URL directly in an `<img>` and let CSS downscale it.
 * Hetzner serves these with open CORS and Range support, so the browser can
 * fetch and decode them without tainting.
 *
 * Everything else returns `icon`:
 * - external references — no presigned URL, CORS not guaranteed
 * - PDF — page-1 rendering needs a dynamically-imported pdf.js (planned
 *   follow-up; this is the seam to extend with a `kind === 'pdf'` branch)
 * - video / audio / 3D models / unsupported types
 *
 * `enabled` is the viewport gate from {@link useInViewport}. While `false` no
 * preview URL is fetched and an image tile reports `loading` (skeleton).
 */
export function useFileThumbnail(
  file: FileData,
  enabled: boolean
): ThumbnailState {
  const kind = detectPreviewKind(detectMimeType(file))
  const isImage =
    kind === 'image' &&
    !isExternalFileReference(file.fileReference) &&
    !!file.fileReference

  // Hook must run unconditionally; the second arg keeps it idle until the tile
  // is an in-viewport image.
  const query = usePreviewUrl(file.fileReference, enabled && isImage)

  if (!isImage) return { status: 'icon' }
  if (query.data?.url) {
    return { status: 'ready', src: query.data.url, tag: 'img' }
  }
  if (query.isError) return { status: 'error' }
  return { status: 'loading' }
}
