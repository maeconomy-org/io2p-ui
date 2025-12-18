'use client'

import { useRef, useState, useEffect } from 'react'
import { FileImage, FileCode } from 'lucide-react'
import QRCodeStyling, {
  CornerSquareType,
  DotType,
  DrawType,
} from 'qr-code-styling'

import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { logger } from '@/lib'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  uuid: string
  objectName: string
}

const qrCodeConfig = (uuid: string, isPrint: boolean = false) => ({
  width: isPrint ? 1200 : 260,
  height: isPrint ? 1200 : 260,
  type: 'svg' as DrawType,
  data: uuid,
  dotsOptions: {
    color: '#000000', // Black for print, blue for display
    type: 'square' as DotType,
  },
  cornersSquareOptions: {
    type: 'extra-rounded' as CornerSquareType,
    color: isPrint ? '#000000' : undefined, // Black for print
  },
  backgroundOptions: {
    color: '#FFFFFF', // White background
  },
  imageOptions: {
    crossOrigin: 'anonymous',
    margin: 20,
  },
})

// QRCodeStyling instance will be created only on client side
let qrCodeInstance: any = null

export function QRCodeModal({
  isOpen,
  onClose,
  uuid,
  objectName,
}: QRCodeModalProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const [qrRendered, setQrRendered] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Initialize QR code on mount and when UUID changes
  useEffect(() => {
    // Skip server-side rendering
    if (typeof window === 'undefined') return

    // Small delay to ensure the ref is available after modal opens
    const timer = setTimeout(() => {
      if (!qrCodeInstance) {
        try {
          qrCodeInstance = new QRCodeStyling(qrCodeConfig(uuid))
        } catch (error) {
          logger.error('Error initializing QR code:', error)
          return
        }
      } else {
        // Update existing instance with new data
        qrCodeInstance.update({
          data: uuid,
        })
      }

      // Clear any previous content
      if (qrCodeRef.current) {
        qrCodeRef.current.innerHTML = ''
        // Append the QR code to the ref
        qrCodeInstance.append(qrCodeRef.current)
        setQrRendered(true)
      }
    }, 100) // Short delay to ensure DOM is ready

    return () => clearTimeout(timer)
  }, [uuid, isOpen]) // Re-run when UUID changes or modal opens

  const handleDownload = async (format: 'png' | 'svg' = 'png') => {
    if (qrCodeInstance && !isDownloading) {
      try {
        setIsDownloading(true)

        // Create a separate instance for downloading to avoid changing the UI
        const downloadInstance = new QRCodeStyling(qrCodeConfig(uuid, true))

        // Download using the high-res instance
        await downloadInstance.download({
          name: `${objectName.replace(/\s+/g, '-')}-qrcode-print`,
          extension: format,
        })
      } catch (error) {
        logger.error('Error downloading QR code:', error)
      } finally {
        setIsDownloading(false)
      }
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
          <DialogTitle>QR Code for {objectName}</DialogTitle>
          <DialogDescription>
            Scan this code to access the object details
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          <div className="max-w-[260px] flex items-center justify-center">
            <div ref={qrCodeRef} />
          </div>

          <div className="mt-4 font-mono text-xs text-muted-foreground break-all text-center flex items-center gap-2">
            <span className="truncate flex">{uuid}</span>
            <CopyButton text={uuid} label="Object UUID" />
          </div>

          <div className="mt-6 flex gap-2 w-full">
            <Button
              onClick={() => handleDownload('png')}
              className="flex-1"
              variant="default"
              disabled={!qrRendered || isDownloading}
            >
              <FileImage className="mr-2 h-4 w-4" />
              PNG
            </Button>

            <Button
              onClick={() => handleDownload('svg')}
              className="flex-1"
              variant="outline"
              disabled={!qrRendered || isDownloading}
            >
              <FileCode className="mr-2 h-4 w-4" />
              SVG
            </Button>
          </div>

          <p className="mt-2 text-xs text-center text-muted-foreground">
            Downloads a high-resolution (1200×1200) version suitable for
            printing
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
