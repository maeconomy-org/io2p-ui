'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import type { FileData } from '@/types'

import { FileTile } from './file-tile'
import { isPreviewableFile } from './file-display'

const AttachmentPreview = dynamic(
  () => import('@/components/attachments').then((m) => m.AttachmentPreview),
  { ssr: false }
)

interface FileGridViewProps {
  files: FileData[]
  className?: string
  /** Show the empty-state message when there are no files. */
  showEmptyState?: boolean
}

/**
 * Grid presentation of an object's files with thumbnails. Mirrors `FileList`'s
 * preview-modal ownership: tiles request a preview via `onPreview`, and this
 * container drives the shared {@link AttachmentPreview} gallery (including
 * prev/next across the previewable siblings).
 */
export function FileGridView({
  files,
  className,
  showEmptyState = true,
}: FileGridViewProps) {
  const t = useTranslations()
  const [previewFile, setPreviewFile] = useState<FileData | null>(null)

  const previewableSiblings = (files ?? []).filter(isPreviewableFile)

  if (!files || files.length === 0) {
    return showEmptyState ? (
      <p className="text-sm text-muted-foreground">
        {t('objects.files.noFiles')}
      </p>
    ) : null
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
        className
      )}
    >
      {files.map((file, index) => (
        <FileTile
          key={file.uuid || file.fileReference || index}
          file={file}
          onPreview={setPreviewFile}
        />
      ))}

      <AttachmentPreview
        file={previewFile}
        siblings={previewableSiblings}
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </div>
  )
}
