'use client'

import { ReactNode, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

interface SheetDropzoneProps {
  children: ReactNode
  onFiles: (files: File[]) => void
  disabled?: boolean
  className?: string
}

export function SheetDropzone({
  children,
  onFiles,
  disabled = false,
  className,
}: SheetDropzoneProps) {
  const t = useTranslations()

  const handleDrop = useCallback(
    (accepted: File[]) => {
      if (disabled || accepted.length === 0) return
      onFiles(accepted)
    },
    [disabled, onFiles]
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    disabled,
    noClick: true,
    noKeyboard: true,
  })

  const showOverlay = isDragActive && !disabled

  return (
    <div
      {...getRootProps()}
      className={cn('relative', className)}
      data-testid="sheet-dropzone"
      data-disabled={disabled}
    >
      {children}
      {showOverlay && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-md',
            'border-2 border-dashed border-primary',
            'bg-gradient-to-b from-black/10 to-black/20 backdrop-blur-sm',
            'dark:from-white/5 dark:to-white/10'
          )}
          data-testid="sheet-dropzone-overlay"
        >
          <div className="flex flex-col items-center gap-2 text-primary">
            <UploadCloud className="h-10 w-10" aria-hidden="true" />
            <p className="text-sm font-medium">
              {t('objects.attachments.dropzoneHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
