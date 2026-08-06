'use client'

import { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'

import { buildQrCodeConfig } from '@/components/modals/qr-code-config'
import { logger } from '@/lib/observability/logger'
import { cn } from '@/lib/utils'

interface PassportQrProps {
  /**
   * UUID encoded as the QR payload. We deliberately encode the bare uuid
   * (not a URL) so a future deep-link handler / mobile app can resolve it
   * without being tied to the current web origin. Web scanners that expect
   * URLs will still display the uuid as plain text — acceptable for a
   * "scan-with-our-app" design.
   */
  uuid: string
  size?: number
  className?: string
}

export function PassportQr({ uuid, size = 128, className }: PassportQrProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const node = containerRef.current
    if (!node) return

    try {
      const instance = new QRCodeStyling(
        buildQrCodeConfig({ data: uuid, size })
      )
      node.innerHTML = ''
      instance.append(node)
    } catch (error) {
      logger.error('Error rendering passport QR:', { err: error })
    }

    return () => {
      if (node) node.innerHTML = ''
    }
  }, [uuid, size])

  return (
    <div
      ref={containerRef}
      data-testid="passport-qr"
      aria-label="Object QR code"
      className={cn('flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    />
  )
}
