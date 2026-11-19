'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib/observability/logger'

interface TextViewerProps {
  src: string
  maxBytes?: number
}

const DEFAULT_MAX_BYTES = 1024 * 1024 // 1 MB

export function TextViewer({
  src,
  maxBytes = DEFAULT_MAX_BYTES,
}: TextViewerProps) {
  const t = useTranslations()
  /**
   * One state stamped with the `src` it belongs to, rather than three fields reset at the top of the
   * effect. The reset is then DERIVED — a result for a previous src simply doesn't match — so
   * switching files shows the loader immediately instead of the old file's text for one render.
   */
  const [result, setResult] = useState<{
    src: string
    text?: string
    tooLarge?: boolean
    error?: string
  } | null>(null)

  const current = result?.src === src ? result : null
  const text = current?.text ?? null
  const tooLarge = current?.tooLarge ?? false
  const error = current?.error ?? null

  useEffect(() => {
    if (!src) return
    const ctrl = new AbortController()

    fetch(src, { signal: ctrl.signal })
      .then(async (res) => {
        const blob = await res.blob()
        if (ctrl.signal.aborted) return
        if (blob.size > maxBytes) {
          setResult({ src, tooLarge: true })
          return
        }
        const body = await blob.text()
        if (ctrl.signal.aborted) return
        setResult({ src, text: body })
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        logger.error('Failed to read text preview', { err })
        setResult({ src, error: String(err) })
      })

    return () => {
      ctrl.abort()
    }
  }, [src, maxBytes])

  if (tooLarge) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-sm text-white/80">
        {t('attachments.preview.tooLargeForPreview')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-sm text-destructive">
        {t('attachments.preview.loadFailed')}
      </div>
    )
  }

  if (text === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-auto bg-white">
      <pre className="m-0 min-h-full w-full whitespace-pre-wrap break-words p-6 font-mono text-xs text-foreground">
        {text}
      </pre>
    </div>
  )
}
