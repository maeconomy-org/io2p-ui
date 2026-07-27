'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib'

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
  const [text, setText] = useState<string | null>(null)
  const [tooLarge, setTooLarge] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return
    const ctrl = new AbortController()

    setText(null)
    setTooLarge(false)
    setError(null)

    fetch(src, { signal: ctrl.signal })
      .then(async (res) => {
        const blob = await res.blob()
        if (ctrl.signal.aborted) return
        if (blob.size > maxBytes) {
          setTooLarge(true)
          return
        }
        const body = await blob.text()
        if (ctrl.signal.aborted) return
        setText(body)
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        logger.error('Failed to read text preview', { error: err })
        setError(String(err))
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
