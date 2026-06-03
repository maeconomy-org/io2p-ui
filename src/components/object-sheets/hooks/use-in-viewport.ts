'use client'

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Latch `true` once the observed element first scrolls within `rootMargin` of
 * the viewport, then disconnect.
 *
 * Used to gate per-tile presigned-URL fetches in the files grid: each tile owns
 * a `usePreviewUrl` call, and without gating a large file list would fire a
 * request for every file on mount. Passing this boolean as the hook's `enabled`
 * arg defers the fetch until the tile is actually near the screen.
 *
 * The latch is intentionally one-way — once a thumbnail has been requested we
 * keep it, so scrolling a tile out and back doesn't re-trigger a fetch or tear
 * down a resolved image. In SSR / environments without `IntersectionObserver`
 * we fall back to eager (`true`).
 */
export function useInViewport<T extends Element>(
  rootMargin = '300px'
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [seen, rootMargin])

  return [ref, seen]
}
