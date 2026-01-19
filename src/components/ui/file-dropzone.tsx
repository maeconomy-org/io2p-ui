'use client'

import { ReactNode, useCallback, useEffect, useState } from 'react'
import { useDropzone, DropzoneOptions } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Loader2, AlertCircle } from 'lucide-react'
import { Progress } from './progress'

export interface FileDropzoneProps extends Omit<DropzoneOptions, 'onDrop'> {
  onDrop: (acceptedFiles: File[]) => void | Promise<void>
  children?: ReactNode
  className?: string
  isLoading?: boolean
  disabled?: boolean
  loadingText?: string
  showLoader?: boolean
  error?: string | null
  progress?: number
}

export function FileDropzone({
  onDrop,
  children,
  className,
  isLoading = false,
  disabled = false,
  loadingText = 'Processing...',
  showLoader = true,
  error = null,
  progress = 0,
  ...props
}: FileDropzoneProps) {
  const [isDropping, setIsDropping] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)

  // Add animation effect after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeIn(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (isLoading || disabled) return
      await onDrop(acceptedFiles)
    },
    [onDrop, isLoading, disabled]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop: handleDrop,
      disabled: isLoading || disabled,
      onDragEnter: () => setIsDropping(true),
      onDragLeave: () => setIsDropping(false),
      ...props,
    })

  // Add rejection error handling
  const hasRejections = fileRejections.length > 0
  const rejectionError = hasRejections
    ? fileRejections[0]?.errors?.[0]?.message || 'File type not accepted'
    : null

  // Calculate animation classes
  const animationClass = fadeIn
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-4'

  return (
    <div className={`space-y-2 transition-all duration-300 ${animationClass}`}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragActive || isDropping
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          (isLoading || disabled) && 'opacity-70 cursor-not-allowed',
          hasRejections && 'border-destructive/50',
          className
        )}
      >
        <input {...getInputProps()} disabled={isLoading || disabled} />

        {isLoading && showLoader ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{loadingText}</p>
            {progress > 0 && (
              <div className="w-full max-w-xs mx-auto mt-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {progress}% complete
                </p>
              </div>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {(error || rejectionError) && (
        <div className="flex items-center space-x-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm mt-0">{error || rejectionError}</p>
        </div>
      )}
    </div>
  )
}
