'use client'

import { FileQuestion } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { formatBytes } from '@/lib/utils'

interface UnsupportedFallbackProps {
  fileName: string
  size?: number
  mimeType?: string
}

export function UnsupportedFallback({
  fileName,
  size,
  mimeType,
}: UnsupportedFallbackProps) {
  const t = useTranslations()
  const readable = formatBytes(size)
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-8 text-center text-white/90">
        <FileQuestion className="h-12 w-12 text-white/70" />
        <h3 className="text-base font-semibold">
          {t('attachments.preview.notSupported')}
        </h3>
        <p className="break-all text-sm text-white/70">{fileName}</p>
        {(readable || mimeType) && (
          <p className="text-xs text-white/50">
            {[mimeType, readable].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="mt-2 text-xs text-white/60">
          {t('attachments.preview.downloadToOpen')}
        </p>
      </div>
    </div>
  )
}
