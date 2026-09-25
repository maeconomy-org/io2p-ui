'use client'

import { useEffect, useRef } from 'react'

interface MediaViewerProps {
  kind: 'video' | 'audio'
  src: string
  mimeType: string
  alt: string
}

// `controlsList` / `disablePictureInPicture` strip the native download button
// and PiP / "show in new tab" entries from Chromium's media controls. Keeping
// the top-bar download in the preview modal as the single download entry
// point avoids duplicate (and unauthenticated) download flows.
const DISABLED_CONTROLS = 'nodownload noremoteplayback noplaybackrate'

// Imperatively swap `src` so a presigned-URL TTL refresh doesn't reset playback
// position, paused state, or volume. Letting React re-render `<video src=...>`
// re-mounts the media element and resets everything to t=0.
function useTimePreservingSrc<T extends HTMLMediaElement>(src: string) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const stripQuery = (u: string) => u.split('?')[0]
    const sameAsset = stripQuery(el.currentSrc || el.src) === stripQuery(src)

    // First mount or actual asset change: just set src and let it load.
    if (!sameAsset) {
      el.src = src
      return
    }

    // Same asset, new presigned URL — preserve playback state across the swap.
    const wasPaused = el.paused
    const savedTime = el.currentTime
    const savedRate = el.playbackRate

    const restore = () => {
      el.removeEventListener('loadedmetadata', restore)
      try {
        el.currentTime = savedTime
        el.playbackRate = savedRate
      } catch {
        // Seeking can throw on streams without a known duration; skip silently.
      }
      if (!wasPaused) {
        void el.play().catch(() => {})
      }
    }

    el.addEventListener('loadedmetadata', restore)
    el.src = src
    el.load()

    return () => el.removeEventListener('loadedmetadata', restore)
  }, [src])

  return ref
}

export function MediaViewer({ kind, src, mimeType, alt }: MediaViewerProps) {
  const videoRef = useTimePreservingSrc<HTMLVideoElement>(src)
  const audioRef = useTimePreservingSrc<HTMLAudioElement>(src)

  if (kind === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <video
          ref={videoRef}
          controls
          controlsList={DISABLED_CONTROLS}
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-full max-w-full rounded-md"
          aria-label={alt}
        >
          <source type={mimeType} />
        </video>
      </div>
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <audio
        ref={audioRef}
        controls
        controlsList={DISABLED_CONTROLS}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full max-w-xl"
        aria-label={alt}
      >
        <source type={mimeType} />
      </audio>
    </div>
  )
}
