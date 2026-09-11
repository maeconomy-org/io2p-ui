'use client'

import { useRef, useState, useEffect } from 'react'
import { FileImage, FileCode } from 'lucide-react'
import { useTranslations } from 'next-intl'
import QRCodeStyling from 'qr-code-styling'

import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { logger } from '@/lib/observability/logger'

import { buildQrCodeConfig } from '@/lib/qr-code'

interface QRCodeDialogProps {
  isOpen: boolean
  onClose: () => void
  uuid: string
  objectName: string
}

export function QRCodeDialog({
  isOpen,
  onClose,
  uuid,
  objectName,
}: QRCodeDialogProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const qrCodeInstanceRef = useRef<QRCodeStyling | null>(null)
  const [qrRendered, setQrRendered] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const t = useTranslations()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isOpen) return

    const timer = setTimeout(() => {
      try {
        qrCodeInstanceRef.current = new QRCodeStyling(
          buildQrCodeConfig({ data: uuid })
        )
      } catch (error) {
        logger.error('Error initializing QR code:', { err: error })
        return
      }

      if (qrCodeRef.current) {
        qrCodeRef.current.innerHTML = ''
        qrCodeInstanceRef.current.append(qrCodeRef.current)
        setQrRendered(true)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      qrCodeInstanceRef.current = null
    }
  }, [uuid, isOpen])

  const handleDownload = async (format: 'png' | 'svg' = 'png') => {
    if (!qrCodeInstanceRef.current || isDownloading) return
    try {
      setIsDownloading(true)
      const downloadInstance = new QRCodeStyling(
        buildQrCodeConfig({ data: uuid, isPrint: true })
      )
      await downloadInstance.download({
        name: `${objectName.replace(/\s+/g, '-')}-qrcode-print`,
        extension: format,
      })
    } catch (error) {
      logger.error('Error downloading QR code:', { err: error })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setQrRendered(false)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('objects.qrCodeTitle', { name: objectName })}
          </DialogTitle>
          <DialogDescription>
            {t('objects.qrCodeDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          <div className="max-w-[260px] flex items-center justify-center">
            <div ref={qrCodeRef} />
          </div>

          <div className="mt-4 font-mono text-xs text-muted-foreground break-all text-center flex items-center gap-2">
            <span className="truncate flex">{uuid}</span>
            <CopyButton text={uuid} label={t('objects.objectUuid')} />
          </div>

          <div className="mt-6 flex gap-2 w-full">
            <Button
              onClick={() => handleDownload('png')}
              className="flex-1"
              variant="default"
              disabled={!qrRendered || isDownloading}
            >
              <FileImage className="mr-2 h-4 w-4" />
              {t('objects.qrCodeDownloadPng')}
            </Button>

            <Button
              onClick={() => handleDownload('svg')}
              className="flex-1"
              variant="outline"
              disabled={!qrRendered || isDownloading}
            >
              <FileCode className="mr-2 h-4 w-4" />
              {t('objects.qrCodeDownloadSvg')}
            </Button>
          </div>

          <p className="mt-2 text-xs text-center text-muted-foreground">
            {t('objects.qrCodeDownloadDescription')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
