'use client'

import { type WheelEvent as ReactWheelEvent } from 'react'
import { Loader2 } from 'lucide-react'

interface ImageViewerProps {
  src: string
  alt: string
  scale: number
  rotation: number
  isLoading?: boolean
  onZoom: (factor: number) => void
  onToggleZoom: () => void
}

export function ImageViewer({
  src,
  alt,
  scale,
  rotation,
  isLoading,
  onZoom,
  onToggleZoom,
}: ImageViewerProps) {
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    onZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1)
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-auto select-none"
      onWheel={onWheel}
      onDoubleClick={onToggleZoom}
    >
      {isLoading || !src ? (
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain transition-transform duration-75 will-change-transform"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
        />
      )}
    </div>
  )
}
