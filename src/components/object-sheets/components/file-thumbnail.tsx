'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

import type { ThumbnailState } from '../hooks/use-file-thumbnail'

interface FileThumbnailProps {
  state: ThumbnailState
  /** Used as the image `alt`; the icon fallback is decorative. */
  alt: string
  /** Glyph shown for non-image files and on load error. */
  icon: ReactElement
  className?: string
}

/**
 * The thumbnail image with a blur-free fade-in once decoded. Thumbnails are
 * low-priority subresources (`fetchPriority="low"`) so they never contend with
 * the sheet's critical requests. The `complete` guard catches images served
 * from cache, whose `load` event can fire before React attaches `onLoad`.
 */
function ThumbnailImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (ref.current?.complete) setLoaded(true)
  }, [src])

  return (
    // Presigned S3 URLs are short-lived and host-arbitrary, so next/image's
    // loader can't process them — a plain <img> (as in image-viewer.tsx).
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onLoad={() => setLoaded(true)}
      className={cn(
        'absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
        loaded ? 'opacity-100' : 'opacity-0',
        className
      )}
    />
  )
}

/**
 * Pure presentation for a tile's thumbnail area. The parent tile owns the
 * viewport gate and the {@link useFileThumbnail} hook and passes the resolved
 * state down — this component only decides what to paint.
 *
 * Every branch fills its container via `absolute inset-0`. The parent provides
 * a `relative aspect-square` box; absolute fill resolves against that generated
 * box, avoiding the percentage-height-vs-`aspect-ratio` quirk that otherwise
 * lets a landscape image stretch the box out of square.
 */
export function FileThumbnail({
  state,
  alt,
  icon,
  className,
}: FileThumbnailProps) {
  if (state.status === 'loading') {
    return (
      <Skeleton
        className={cn('absolute inset-0 h-full w-full rounded-none', className)}
      />
    )
  }

  if (state.status === 'ready') {
    return <ThumbnailImage src={state.src} alt={alt} className={className} />
  }

  // 'icon' | 'error'
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground',
        className
      )}
    >
      {icon}
    </div>
  )
}
