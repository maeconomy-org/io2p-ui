'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { authFetch } from '@/lib/auth/fetch'
import { buildQrCodeConfig } from '@/components/modals/qr-code-config'

import { useObjects } from '@/hooks/api/entities'
import { PassportView } from './passport-view'

interface ProductPassportSheetProps {
  isOpen: boolean
  onClose: () => void
  uuid?: string
  /** Optional fallback object so the title shows immediately while data loads. */
  object?: { id?: string; name?: string } | null
}

/**
 * Standalone, wider product-passport sheet opened from the objects table row
 * dropdown. Reuses `PassportView` for the actual rendering — this wrapper just
 * fetches the aggregate and provides the sheet chrome.
 */
export function ProductPassportSheet({
  isOpen,
  onClose,
  uuid,
  object: initialObject,
}: ProductPassportSheetProps) {
  const t = useTranslations()
  const locale = useLocale() as 'en' | 'nl'

  const [isDownloading, setIsDownloading] = useState(false)

  // Straight from io2p — the passport renderers speak its vocabulary now, so there is nothing to
  // translate and no hook to hold the translation.
  const { data: object, isLoading } = useObjects().useGet(
    isOpen ? uuid : undefined
  )

  async function handleDownloadPdf() {
    if (!uuid || isDownloading) return
    setIsDownloading(true)
    try {
      // Generate QR matching the on-screen passport (logo, dot style, etc.)
      const QRCodeStyling = (await import('qr-code-styling')).default
      const qrInstance = new QRCodeStyling(
        buildQrCodeConfig({ data: uuid, size: 160 })
      )
      const qrRaw = await qrInstance.getRawData('png')
      if (!qrRaw || !(qrRaw instanceof Blob))
        throw new Error('QR generation failed')
      const qrDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(qrRaw)
      })

      const res = await authFetch(`/api/passport/${uuid}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object,
          properties: object?.properties ?? [],
          files: object?.files ?? [],
          addressInfo: object?.address ?? null,
          qrDataUrl,
          locale,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `passport-${object?.name ?? uuid}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('objects.passport.pdfError'))
    } finally {
      setIsDownloading(false)
    }
  }

  const displayName =
    object?.name ?? initialObject?.name ?? t('objects.passport.untitled')

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="sm:max-w-4xl flex flex-col"
        data-testid="product-passport-sheet"
      >
        {/* Title + description are required for Radix a11y but visually
            redundant — the passport hero below repeats the name and purpose,
            so we hide them from sighted users while keeping screen-reader
            output intact. */}
        <SheetHeader className="sr-only">
          <SheetTitle>{displayName}</SheetTitle>
          <SheetDescription>
            {t('objects.passport.sheetDescription')}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-1 -mx-1">
            <PassportView
              object={object ?? null}
              properties={object?.properties ?? []}
              files={object?.files ?? []}
              addressInfo={object?.address ?? null}
            />
          </div>
        )}

        <div
          className="flex-shrink-0 flex items-center justify-end gap-2 border-t pt-3 mt-2"
          data-testid="passport-footer"
        >
          {uuid && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              data-testid="passport-download-pdf-button"
            >
              {isDownloading ? (
                <Loader2
                  className="h-3.5 w-3.5 mr-1.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              )}
              {t('objects.passport.downloadPdf')}
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            data-testid="passport-close-button"
          >
            <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            {t('common.close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
