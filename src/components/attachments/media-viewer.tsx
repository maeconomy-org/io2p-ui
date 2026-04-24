'use client'

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

export function MediaViewer({ kind, src, mimeType, alt }: MediaViewerProps) {
  if (kind === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <video
          src={src}
          controls
          controlsList={DISABLED_CONTROLS}
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-full max-w-full rounded-md"
          aria-label={alt}
        >
          <source src={src} type={mimeType} />
        </video>
      </div>
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <audio
        src={src}
        controls
        controlsList={DISABLED_CONTROLS}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full max-w-xl"
        aria-label={alt}
      >
        <source src={src} type={mimeType} />
      </audio>
    </div>
  )
}
