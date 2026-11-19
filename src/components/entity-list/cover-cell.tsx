'use client'

import { useTranslations } from 'next-intl'
import { ImageIcon } from 'lucide-react'
import type { CoverImage } from 'io2p-client'

import {
  HoverCard,
  HoverCardMediaContent,
  HoverCardTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * The thumbnail column: a small image per row that opens a larger one on hover.
 *
 * ONE image serves both sizes. The derive worker writes a 320px-wide thumbnail and the preview here
 * is ~240px, so the row thumb and the hover card share `thumbnailUrl` — no signed URL is minted per
 * hovered row, which is what a full-size preview would have cost. `downloadUrl` is deliberately
 * never enriched, so there is no larger image to reach for without a request anyway.
 *
 * Takes the cover ref, not a row, so processes (or a future card view) can use it unchanged.
 */
export function CoverCell({
  cover,
  /** Alt text — the entity's name, since the picture stands for the entity. */
  name,
  className,
}: {
  cover?: CoverImage | null
  name?: string
  className?: string
}) {
  const t = useTranslations()

  // No cover set, or set but not yet thumbnailed — the same placeholder either way. A cover whose
  // worker has not run has nothing to show, and a broken image would read as an error rather than
  // as "none chosen".
  if (!cover?.thumbnailUrl) {
    return (
      <div
        className={cn(
          'flex h-6 w-8 items-center justify-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/40',
          className
        )}
        // Not `alt`-equivalent noise on every row: the placeholder says nothing a screen reader
        // needs, and the name is in the very next cell.
        aria-hidden="true"
        data-testid="cover-placeholder"
      >
        <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
      </div>
    )
  }

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        {/* The TRIGGER is the thumbnail, not the row: hovering anywhere in a row to get a picture
            would fire on every pass of the pointer down the table. */}
        <button
          type="button"
          // Cursor stays default — this opens nothing on click, it only reveals a bigger view.
          className={cn(
            'block h-6 w-8 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
          aria-label={t('objects.cover.previewOf', { name: name ?? '' })}
          data-testid="cover-thumb"
        >
          <img
            src={cover.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </button>
      </HoverCardTrigger>

      {/* Right of the thumbnail and vertically centred on it, so the row stays readable behind it.
          Radix flips on collision, which is what puts it above the header near the top of a list. */}
      <HoverCardMediaContent side="right" align="center">
        <img
          data-testid="cover-preview"
          src={cover.thumbnailUrl}
          alt={name ?? ''}
          // The source dimensions come with the ref, so the card opens at the picture's shape
          // instead of snapping from a square once the image decodes.
          style={
            cover.width && cover.height
              ? { aspectRatio: `${cover.width} / ${cover.height}` }
              : undefined
          }
          className="block h-auto max-h-72 w-60 rounded-lg object-cover"
        />
      </HoverCardMediaContent>
    </HoverCard>
  )
}
