'use client'

import { useTranslations } from 'next-intl'

interface PdfViewerProps {
  src: string
  title: string
}

export function PdfViewer({ src, title }: PdfViewerProps) {
  const t = useTranslations()
  return (
    <div className="h-full w-full bg-zinc-100">
      <object
        data={src}
        type="application/pdf"
        className="h-full w-full"
        aria-label={title}
        data-testid="pdf-viewer-object"
      >
        <div className="flex h-full w-full items-center justify-center p-6 text-sm text-zinc-700">
          {t('attachments.preview.downloadToOpen')}
        </div>
      </object>
    </div>
  )
}
